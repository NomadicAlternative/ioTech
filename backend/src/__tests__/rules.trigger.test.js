'use strict';

/**
 * E2E tests for rule-triggered actions.
 *
 * Creates a threshold rule, sends telemetry that crosses the threshold,
 * and verifies that devicesService.sendCommand() was called with the
 * correct action payload.
 *
 * These tests require a real PostgreSQL database with the schema migrated.
 * They are conditionally skipped unless both DATABASE_URL and
 * TEST_INTEGRATION=true are set in the environment.
 *
 * How to run:
 *   DATABASE_URL=postgres://... TEST_INTEGRATION=true npx jest rules.trigger
 */

const { v4: uuidv4 } = require('uuid');

// ─── Conditional skip guard ───────────────────────────────────────────────────
const canRunIntegration =
  process.env.DATABASE_URL && process.env.TEST_INTEGRATION === 'true';

(canRunIntegration ? describe : describe.skip)('Rules API — Triggered Actions', () => {
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
      name: `Rules Trigger Tenant ${tenantId.slice(0, 8)}`,
    });

    // ── Create device template ─────────────────────────────────────────────
    await db('device_templates').insert({
      id: uuidv4(),
      tenant_id: tenantId,
      name: 'Test Template',
      schema: JSON.stringify({}),
    });

    // ── Create a device ────────────────────────────────────────────────────
    deviceId = uuidv4();
    await db('devices').insert({
      id: deviceId,
      tenant_id: tenantId,
      template_id: null,
      device_token: uuidv4(),
      name: 'Trigger Test Device',
      status: 'active',
    });

    // ── Mock devicesService.sendCommand ────────────────────────────────────
    // We mock it so we can assert it was called with the right params
    const devicesService = require('../modules/devices/devices.service');
    sendCommandMock = jest.spyOn(devicesService, 'sendCommand').mockResolvedValue({ ok: true });
  });

  afterAll(async () => {
    if (db) {
      // Clean up in reverse FK order
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
   * Create a threshold rule in the DB directly (bypassing API for speed).
   */
  async function createThresholdRule(field, operator, value, cooldownMs) {
    const { v4: uuid } = require('uuid');
    const ruleId = uuid();
    const now = new Date();

    await db('rules').insert({
      id: ruleId,
      tenant_id: tenantId,
      name: `Trigger ${field} ${operator} ${value}`,
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

  it('triggers action when telemetry exceeds threshold', async () => {
    // Create a rule: temperature > 30
    await createThresholdRule('temperature', 'gt', 30, 0);

    // Reset mock calls from setup
    sendCommandMock.mockClear();

    // Send telemetry with temp=35 (above threshold)
    await ingestTelemetry({ temperature: 35 });

    // Allow async evaluation to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(sendCommandMock).toHaveBeenCalled();
    const callArgs = sendCommandMock.mock.calls[0];
    expect(callArgs[0]).toBe(tenantId); // tenantId
    expect(callArgs[1]).toBe(deviceId); // deviceId
    expect(callArgs[2]).toMatchObject({
      action: 'relay',
      relay: 1,
      state: true,
    });
  });

  it('does NOT trigger action when telemetry is below threshold', async () => {
    // Reset mock
    sendCommandMock.mockClear();

    // Send telemetry with temp=25 (below threshold of 30)
    await ingestTelemetry({ temperature: 25 });

    // Allow async evaluation to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(sendCommandMock).not.toHaveBeenCalled();
  });

  it('triggers action on exact threshold match with gte operator', async () => {
    const { v4: uuid } = require('uuid');
    const ruleId = uuid();
    const now = new Date();

    // Create rule: humidity >= 80
    await db('rules').insert({
      id: ruleId,
      tenant_id: tenantId,
      name: 'Trigger humidity >= 80',
      description: null,
      enabled: true,
      trigger_type: 'threshold',
      trigger_config: JSON.stringify({ field: 'humidity', operator: 'gte', value: 80 }),
      action_type: 'relay',
      action_config: JSON.stringify({ relay: 2, state: true }),
      cooldown_ms: 0,
      last_fired_at: null,
      created_at: now,
      updated_at: now,
    });

    sendCommandMock.mockClear();

    // Send humidity=80 (exact match)
    await ingestTelemetry({ humidity: 80 });

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(sendCommandMock).toHaveBeenCalled();
    const callArgs = sendCommandMock.mock.calls[0];
    expect(callArgs[2]).toMatchObject({
      action: 'relay',
      relay: 2,
      state: true,
    });
  });
});
