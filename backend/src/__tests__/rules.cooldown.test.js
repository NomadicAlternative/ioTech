'use strict';

/**
 * E2E tests for rules cooldown behavior.
 *
 * Creates a rule with a cooldown_ms, triggers it, and verifies that
 * the action is blocked during cooldown and fires again after cooldown expires.
 *
 * These tests require a real PostgreSQL database with the schema migrated.
 * They are conditionally skipped unless both DATABASE_URL and
 * TEST_INTEGRATION=true are set in the environment.
 *
 * How to run:
 *   DATABASE_URL=postgres://... TEST_INTEGRATION=true npx jest rules.cooldown
 */

const { v4: uuidv4 } = require('uuid');

// ─── Conditional skip guard ───────────────────────────────────────────────────
const canRunIntegration =
  process.env.DATABASE_URL && process.env.TEST_INTEGRATION === 'true';

(canRunIntegration ? describe : describe.skip)('Rules API — Cooldown Behavior', () => {
  let db;
  let tenantId;
  let deviceId;
  let sendCommandMock;

  // ─── Setup ─────────────────────────────────────────────────────────────────

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';

    db = require('../shared/db/knex');

    // ── Create test tenant ────────────────────────────────────────────────
    tenantId = uuidv4();
    await db('tenants').insert({
      id: tenantId,
      name: `Rules Cooldown Tenant ${tenantId.slice(0, 8)}`,
    });

    // ── Create device template ─────────────────────────────────────────────
    await db('device_templates').insert({
      id: uuidv4(),
      tenant_id: tenantId,
      name: 'Cooldown Test Template',
      schema: JSON.stringify({}),
    });

    // ── Create a device ────────────────────────────────────────────────────
    deviceId = uuidv4();
    await db('devices').insert({
      id: deviceId,
      tenant_id: tenantId,
      template_id: null,
      device_token: uuidv4(),
      name: 'Cooldown Test Device',
      status: 'active',
    });

    // ── Mock devicesService.sendCommand ────────────────────────────────────
    const devicesService = require('../modules/devices/devices.service');
    sendCommandMock = jest.spyOn(devicesService, 'sendCommand').mockResolvedValue({ ok: true });
  });

  afterAll(async () => {
    if (db) {
      await db('telemetry').where({ device_id: deviceId }).delete();
      await db('rules').where({ tenant_id: tenantId }).delete();
      await db('devices').where({ tenant_id: tenantId }).delete();
      await db('device_templates').where({ tenant_id: tenantId }).delete();
      await db('users').where({ tenant_id: tenantId }).delete();
      await db('telemetry').where({ device_id: deviceId }).delete();
      await db('tenants').where({ id: tenantId }).delete();
      await db.destroy();
    }

    if (sendCommandMock) {
      sendCommandMock.mockRestore();
    }
  });

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Create a threshold rule in the DB directly.
   */
  async function createThresholdRule(field, operator, value, cooldownMs) {
    const ruleId = uuidv4();
    const now = new Date();

    await db('rules').insert({
      id: ruleId,
      tenant_id: tenantId,
      name: `Cooldown ${field} ${operator} ${value}`,
      description: null,
      enabled: true,
      trigger_type: 'threshold',
      trigger_config: JSON.stringify({ field, operator, value }),
      action_type: 'relay',
      action_config: JSON.stringify({ relay: 1, state: true }),
      cooldown_ms: cooldownMs || 0,
      last_fired_at: null,
      created_at: now,
      updated_at: now,
    });

    return ruleId;
  }

  /**
   * Ingest telemetry directly via the telemetry service.
   */
  async function ingestTelemetry(telemetryData) {
    const telemetryService = require('../modules/telemetry/telemetry.service');
    await telemetryService.ingest(tenantId, deviceId, telemetryData);
  }

  // ─── Tests ─────────────────────────────────────────────────────────────────

  it('triggers action on first telemetry above threshold', async () => {
    // Create rule: temperature > 30 with 5000ms cooldown
    await createThresholdRule('temperature', 'gt', 30, 5000);

    sendCommandMock.mockClear();

    // First trigger — should fire
    await ingestTelemetry({ temperature: 35 });

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(sendCommandMock).toHaveBeenCalledTimes(1);
    const callArgs = sendCommandMock.mock.calls[0];
    expect(callArgs[2]).toMatchObject({
      action: 'relay',
      relay: 1,
      state: true,
    });
  });

  it('blocks action during cooldown period', async () => {
    sendCommandMock.mockClear();

    // Second telemetry immediately after — cooldown should block
    await ingestTelemetry({ temperature: 40 });

    await new Promise((resolve) => setTimeout(resolve, 500));

    // sendCommand should NOT have been called again (still in cooldown)
    expect(sendCommandMock).not.toHaveBeenCalled();
  });

  it('allows action again after cooldown expires', async () => {
    // Wait for cooldown to expire (5000ms rule + buffer)
    await new Promise((resolve) => setTimeout(resolve, 5500));

    sendCommandMock.mockClear();

    // Third telemetry — cooldown has expired, should fire again
    await ingestTelemetry({ temperature: 45 });

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(sendCommandMock).toHaveBeenCalledTimes(1);
    const callArgs = sendCommandMock.mock.calls[0];
    expect(callArgs[2]).toMatchObject({
      action: 'relay',
      relay: 1,
      state: true,
    });
  });

  it('works with gte operator and cooldown', async () => {
    // Reset the in-memory cooldown cache before testing
    const rulesEngine = require('../modules/rules/rulesEngine');
    rulesEngine.resetCooldownCache();

    // Create a separate rule with a short cooldown
    const ruleId = uuidv4();
    const now = new Date();
    await db('rules').insert({
      id: ruleId,
      tenant_id: tenantId,
      name: 'Cooldown humidity >= 80',
      description: null,
      enabled: true,
      trigger_type: 'threshold',
      trigger_config: JSON.stringify({ field: 'humidity', operator: 'gte', value: 80 }),
      action_type: 'relay',
      action_config: JSON.stringify({ relay: 2, state: true }),
      cooldown_ms: 3000,
      last_fired_at: null,
      created_at: now,
      updated_at: now,
    });

    sendCommandMock.mockClear();

    // First trigger with exact match
    await ingestTelemetry({ humidity: 85 });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(sendCommandMock).toHaveBeenCalledTimes(1);

    // Second trigger immediately — should be blocked
    sendCommandMock.mockClear();
    await ingestTelemetry({ humidity: 90 });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(sendCommandMock).not.toHaveBeenCalled();

    // Wait for cooldown to expire
    await new Promise((resolve) => setTimeout(resolve, 3500));

    // Third trigger — should fire again
    sendCommandMock.mockClear();
    await ingestTelemetry({ humidity: 82 });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(sendCommandMock).toHaveBeenCalledTimes(1);
  });
});
