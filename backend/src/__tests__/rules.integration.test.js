'use strict';

/**
 * Integration tests for automation rules full flow.
 *
 * Tests:
 *   1. Rule CRUD via HTTP (POST → rule exists in DB → GET returns it)
 *   2. Threshold rule triggers telemetry → rule fires → sendCommand called
 *   3. Cooldown behavior: fire → block → allow after period
 *
 * These tests require a real PostgreSQL database with the schema migrated.
 * They are conditionally skipped unless both DATABASE_URL and
 * TEST_INTEGRATION=true are set in the environment.
 *
 * How to run:
 *   DATABASE_URL=postgres://... TEST_INTEGRATION=true npx jest rules.integration
 */

const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

// ─── Conditional skip guard ───────────────────────────────────────────────────
const canRunIntegration =
  process.env.DATABASE_URL && process.env.TEST_INTEGRATION === 'true';

// ─── Mock devices.service for trigger tests ───────────────────────────────────
// We mock sendCommand at the top level so telemetry.service imports the mock.
// The real module's other functions are also imported when needed via require().
const mockSendCommand = jest.fn().mockResolvedValue({ ok: true, topic: 'test' });
jest.mock('../modules/devices/devices.service', () => ({
  sendCommand: mockSendCommand,
  // Other exports from devices.service are mocked with empty functions
  // to prevent import errors. Individual tests that need real implementations
  // should NOT be in this describe block — they should use request(app) instead.
  list: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  getProvisioningCredentials: jest.fn(),
}));

(canRunIntegration ? describe : describe.skip)('Rules Integration', () => {
  let app;
  let db;
  let tenantId;
  let deviceId;
  let templateId;
  let rulesEngine;

  // ─── Setup ─────────────────────────────────────────────────────────────────

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET || 'integration-test-refresh-secret';
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';
    process.env.NODE_ENV = 'test';

    const createApp = require('../app');
    db = require('../shared/db/knex');
    app = createApp();
    rulesEngine = require('../modules/rules/rulesEngine');

    // Create unique tenant
    tenantId = uuidv4();
    await db('tenants').insert({
      id: tenantId,
      name: `Rules Test Tenant ${tenantId.slice(0, 8)}`,
    });

    // Device template with temperature datastream
    const [template] = await db('device_templates')
      .insert({
        id: uuidv4(),
        tenant_id: tenantId,
        name: 'Rules Test Template',
        datastreams: JSON.stringify([
          { key: 'temperature', type: 'number', direction: 'input', unit: '°C' },
          { key: 'humidity', type: 'number', direction: 'input', unit: '%' },
        ]),
      })
      .returning('*');
    templateId = template.id;

    // Active device
    const [device] = await db('devices')
      .insert({
        id: uuidv4(),
        tenant_id: tenantId,
        template_id: templateId,
        name: 'Rules Test Device',
        status: 'active',
        device_token: uuidv4(),
      })
      .returning('*');
    deviceId = device.id;
  });

  afterAll(async () => {
    if (db) {
      await db('rules').where({ tenant_id: tenantId }).delete();
      await db('telemetry').where({ device_id: deviceId }).delete();
      await db('devices').where({ id: deviceId }).delete();
      await db('device_templates').where({ id: templateId }).delete();
      await db('tenants').where({ id: tenantId }).delete();
      await db.destroy();
    }
  });

  // ─── Auth helper ────────────────────────────────────────────────────────────

  function createToken(tId) {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { userId: 'int-user', tenantId: tId || tenantId, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  //  1. CRUD: POST → will appear in GET
  // ═════════════════════════════════════════════════════════════════════════════

  describe('CRUD: create and list rules', () => {
    let createdId;

    afterAll(async () => {
      if (createdId) await db('rules').where({ id: createdId }).delete();
    });

    it('POST /api/rules creates a rule and returns 201 with id', async () => {
      const res = await request(app)
        .post('/api/rules')
        .set({ Authorization: `Bearer ${createToken()}` })
        .send({
          name: 'E2E Test Rule',
          description: 'Created during integration test',
          enabled: true,
          triggerType: 'threshold',
          triggerConfig: { field: 'temperature', operator: 'gt', value: 30 },
          actionType: 'relay',
          actionConfig: { relay: 1, state: true },
          cooldownMs: 5000,
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        name: 'E2E Test Rule',
        triggerType: 'threshold',
        actionType: 'relay',
      });
      expect(res.body.data.id).toBeDefined();
      createdId = res.body.data.id;

      // Verify in DB directly
      const dbRule = await db('rules').where({ id: createdId }).first();
      expect(dbRule).toBeDefined();
      expect(dbRule.name).toBe('E2E Test Rule');
    });

    it('GET /api/rules returns the created rule in the list', async () => {
      const res = await request(app)
        .get('/api/rules')
        .set({ Authorization: `Bearer ${createToken()}` });

      expect(res.status).toBe(200);
      const match = res.body.data.find((r) => r.name === 'E2E Test Rule');
      expect(match).toBeDefined();
    });

    it('GET /api/rules returns empty for a tenant with no rules', async () => {
      const emptyTenant = uuidv4();
      await db('tenants').insert({ id: emptyTenant, name: 'Empty' });
      try {
        const res = await request(app)
          .get('/api/rules')
          .set({ Authorization: `Bearer ${createToken(emptyTenant)}` });
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]);
      } finally {
        await db('tenants').where({ id: emptyTenant }).delete();
      }
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  //  2. Threshold trigger: telemetry above threshold → sendCommand called
  // ═════════════════════════════════════════════════════════════════════════════

  describe('Threshold trigger → sendCommand', () => {
    let ruleId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/rules')
        .set({ Authorization: `Bearer ${createToken()}` })
        .send({
          name: 'Trigger Test Rule',
          description: 'temp > 30 → relay 1 on',
          enabled: true,
          triggerType: 'threshold',
          triggerConfig: { field: 'temperature', operator: 'gt', value: 30 },
          actionType: 'relay',
          actionConfig: { relay: 1, state: true },
          cooldownMs: 0,
        });
      ruleId = res.body.data.id;
      rulesEngine.resetCooldownCache();
    });

    afterAll(async () => {
      if (ruleId) await db('rules').where({ id: ruleId }).delete();
    });

    beforeEach(() => {
      rulesEngine.resetCooldownCache();
      const devicesService = require('../modules/devices/devices.service');
      devicesService.sendCommand.mockClear();
    });

    it('fires sendCommand when telemetry exceeds threshold', async () => {
      const telemetryService = require('../modules/telemetry/telemetry.service');
      const devicesService = require('../modules/devices/devices.service');

      await telemetryService.ingest(tenantId, deviceId, { temperature: 35 });
      await new Promise((resolve) => setTimeout(resolve, 800));

      expect(devicesService.sendCommand).toHaveBeenCalled();

      const args = devicesService.sendCommand.mock.calls[0];
      expect(args[0]).toBe(tenantId);
      expect(args[1]).toBe(deviceId);
      expect(args[2]).toMatchObject({
        action: 'relay',
        relay: 1,
        state: true,
      });
    });

    it('does NOT fire for telemetry below threshold', async () => {
      const telemetryService = require('../modules/telemetry/telemetry.service');
      const devicesService = require('../modules/devices/devices.service');

      await telemetryService.ingest(tenantId, deviceId, { temperature: 25 });
      await new Promise((resolve) => setTimeout(resolve, 800));

      // sendCommand should NOT have been called (mock clears in beforeEach)
      expect(devicesService.sendCommand).not.toHaveBeenCalled();
    });

    it('fires for exact threshold match when operator is gte', async () => {
      // Create a separate rule with gte operator
      const rulesService = require('../modules/rules/rules.service');
      const gteRule = await rulesService.create(tenantId, {
        name: 'GTE Test Rule',
        enabled: true,
        triggerType: 'threshold',
        triggerConfig: { field: 'temperature', operator: 'gte', value: 30 },
        actionType: 'relay',
        actionConfig: { relay: 2, state: false },
        cooldownMs: 0,
      });

      const telemetryService = require('../modules/telemetry/telemetry.service');
      const devicesService = require('../modules/devices/devices.service');

      devicesService.sendCommand.mockClear();
      rulesEngine.resetCooldownCache();

      // Send temp=30 which should match gte
      await telemetryService.ingest(tenantId, deviceId, { temperature: 30 });
      await new Promise((resolve) => setTimeout(resolve, 800));

      expect(devicesService.sendCommand).toHaveBeenCalled();

      // Clean up
      await db('rules').where({ id: gteRule.id }).delete();
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  //  3. Cooldown behavior
  // ═════════════════════════════════════════════════════════════════════════════

  describe('Cooldown: blocks re-trigger, allows after expiry', () => {
    let ruleId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/rules')
        .set({ Authorization: `Bearer ${createToken()}` })
        .send({
          name: 'Cooldown Test Rule',
          description: '5s cooldown',
          enabled: true,
          triggerType: 'threshold',
          triggerConfig: { field: 'temperature', operator: 'gt', value: 30 },
          actionType: 'relay',
          actionConfig: { relay: 1, state: true },
          cooldownMs: 5000,
        });
      ruleId = res.body.data.id;
    });

    afterAll(async () => {
      if (ruleId) await db('rules').where({ id: ruleId }).delete();
    });

    beforeEach(() => {
      rulesEngine.resetCooldownCache();
      const devicesService = require('../modules/devices/devices.service');
      devicesService.sendCommand.mockClear();
    });

    it('fires the first time since cooldown is empty', async () => {
      const telemetryService = require('../modules/telemetry/telemetry.service');
      const devicesService = require('../modules/devices/devices.service');

      await telemetryService.ingest(tenantId, deviceId, { temperature: 35 });
      await new Promise((resolve) => setTimeout(resolve, 800));

      expect(devicesService.sendCommand).toHaveBeenCalledTimes(1);
    });

    it('blocks a second trigger within the cooldown window', async () => {
      const telemetryService = require('../modules/telemetry/telemetry.service');
      const devicesService = require('../modules/devices/devices.service');

      // First trigger
      await telemetryService.ingest(tenantId, deviceId, { temperature: 35 });
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(devicesService.sendCommand).toHaveBeenCalledTimes(1);

      // Second trigger immediately — blocked by cooldown
      await telemetryService.ingest(tenantId, deviceId, { temperature: 40 });
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Still only 1 call
      expect(devicesService.sendCommand).toHaveBeenCalledTimes(1);
    });

    it('allows re-trigger after cooldown has expired', async () => {
      const telemetryService = require('../modules/telemetry/telemetry.service');
      const devicesService = require('../modules/devices/devices.service');

      // Wait for 5s cooldown + buffer
      await new Promise((resolve) => setTimeout(resolve, 5500));

      // Third trigger
      await telemetryService.ingest(tenantId, deviceId, { temperature: 35 });
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should now have 2 calls (first + this one)
      expect(devicesService.sendCommand).toHaveBeenCalledTimes(2);
    });
  });
});
