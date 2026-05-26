'use strict';

/**
 * Unit tests for mqtt/handlers/heartbeat.js
 * Covers: last_seen + status update, offline timer, malformed payload rejection.
 */

jest.mock('../../modules/devices/devices.model');
jest.mock('../../shared/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('../../socket/socketServer');
jest.mock('../../modules/rules/rules.model');
jest.mock('../../modules/rules/rulesEngine');
jest.mock('../../modules/devices/devices.service');

const devicesModel = require('../../modules/devices/devices.model');
const { getSocketService } = require('../../socket/socketServer');
const rulesModel = require('../../modules/rules/rules.model');
const rulesEngine = require('../../modules/rules/rulesEngine');
const devicesService = require('../../modules/devices/devices.service');
const { handleHeartbeat, _timers, OFFLINE_TIMEOUT_MS } = require('../handlers/heartbeat');

const TENANT_ID = 'tenant-uuid-1';
const DEVICE_ID = 'device-uuid-1';

describe('handleHeartbeat()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Clear any lingering timers between tests
    _timers.forEach((t) => clearTimeout(t));
    _timers.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Online update ──────────────────────────────────────────────────────────

  it('updates last_seen AND status=online for a valid payload', async () => {
    devicesModel.update.mockResolvedValue({ id: DEVICE_ID });

    await handleHeartbeat(TENANT_ID, DEVICE_ID, { status: 'online' });

    expect(devicesModel.update).toHaveBeenCalledWith(
      DEVICE_ID,
      expect.objectContaining({ last_seen: expect.any(Date), status: 'online' })
    );
  });

  it('updates last_seen even when payload has extra fields', async () => {
    devicesModel.update.mockResolvedValue({ id: DEVICE_ID });

    await handleHeartbeat(TENANT_ID, DEVICE_ID, { status: 'online', battery: 82, temp: 24.5 });

    expect(devicesModel.update).toHaveBeenCalledTimes(1);
  });

  // ── Guard clauses ──────────────────────────────────────────────────────────

  it('does NOT call devicesModel.update when payload is null (malformed)', async () => {
    await handleHeartbeat(TENANT_ID, DEVICE_ID, null);

    expect(devicesModel.update).not.toHaveBeenCalled();
  });

  it('does NOT call devicesModel.update when deviceId is missing', async () => {
    await handleHeartbeat(TENANT_ID, null, { status: 'online' });

    expect(devicesModel.update).not.toHaveBeenCalled();
  });

  // ── Offline timer ──────────────────────────────────────────────────────────

  it('registers an offline timer after a valid heartbeat', async () => {
    devicesModel.update.mockResolvedValue({ id: DEVICE_ID });

    await handleHeartbeat(TENANT_ID, DEVICE_ID, { status: 'online' });

    expect(_timers.has(DEVICE_ID)).toBe(true);
  });

  it('marks device offline and emits device:status after OFFLINE_TIMEOUT_MS', async () => {
    devicesModel.update.mockResolvedValue({ id: DEVICE_ID });
    const emitDeviceStatus = jest.fn();
    getSocketService.mockReturnValue({ emitDeviceStatus });

    await handleHeartbeat(TENANT_ID, DEVICE_ID, { status: 'online' });

    // Advance time to trigger the offline timeout
    jest.advanceTimersByTime(OFFLINE_TIMEOUT_MS);
    // Let the async callback in the timer settle
    await Promise.resolve();

    expect(devicesModel.update).toHaveBeenLastCalledWith(DEVICE_ID, { status: 'offline' });
    expect(emitDeviceStatus).toHaveBeenCalledWith(TENANT_ID, DEVICE_ID, 'offline');
    expect(_timers.has(DEVICE_ID)).toBe(false);
  });

  it('resets the timer when a second heartbeat arrives before timeout', async () => {
    devicesModel.update.mockResolvedValue({ id: DEVICE_ID });
    const emitDeviceStatus = jest.fn();
    getSocketService.mockReturnValue({ emitDeviceStatus });

    await handleHeartbeat(TENANT_ID, DEVICE_ID, { status: 'online' });

    // Advance halfway, then send another heartbeat
    jest.advanceTimersByTime(OFFLINE_TIMEOUT_MS / 2);
    await handleHeartbeat(TENANT_ID, DEVICE_ID, { status: 'online' });

    // Advance another half — total elapsed = OFFLINE_TIMEOUT_MS, but timer was reset
    jest.advanceTimersByTime(OFFLINE_TIMEOUT_MS / 2);
    await Promise.resolve();

    // Should NOT have fired offline yet — timer reset to full 60s on second heartbeat.
    // emitDeviceStatus('online') was called on both heartbeats, so we check specifically
    // that the 'offline' notification did NOT fire.
    expect(emitDeviceStatus).not.toHaveBeenCalledWith(TENANT_ID, DEVICE_ID, 'offline');
  });

  it('does NOT emit offline when socket service is unavailable', async () => {
    devicesModel.update.mockResolvedValue({ id: DEVICE_ID });
    getSocketService.mockReturnValue(null);

    await handleHeartbeat(TENANT_ID, DEVICE_ID, { status: 'online' });
    jest.advanceTimersByTime(OFFLINE_TIMEOUT_MS);
    await Promise.resolve();

    // DB update still happens
    expect(devicesModel.update).toHaveBeenLastCalledWith(DEVICE_ID, { status: 'offline' });
    // But no crash — getSocketService returned null
  });

  // ── Firmware version sync ─────────────────────────────────────────────────

  it('updates firmware_version when payload contains firmwareVersion', async () => {
    devicesModel.update.mockResolvedValue({ id: DEVICE_ID });

    await handleHeartbeat(TENANT_ID, DEVICE_ID, { status: 'online', firmwareVersion: '2.0.0' });

    expect(devicesModel.update).toHaveBeenCalledWith(
      DEVICE_ID,
      expect.objectContaining({ firmware_version: '2.0.0' })
    );
  });

  it('does NOT update firmware_version when payload has no firmwareVersion', async () => {
    devicesModel.update.mockResolvedValue({ id: DEVICE_ID });

    await handleHeartbeat(TENANT_ID, DEVICE_ID, { status: 'online' });

    // The update call should NOT include firmware_version
    const updateCall = devicesModel.update.mock.calls[0][1];
    expect(updateCall.firmware_version).toBeUndefined();
  });

  it('does NOT update firmware_version when firmwareVersion is empty string', async () => {
    devicesModel.update.mockResolvedValue({ id: DEVICE_ID });

    await handleHeartbeat(TENANT_ID, DEVICE_ID, { status: 'online', firmwareVersion: '' });

    const updateCall = devicesModel.update.mock.calls[0][1];
    expect(updateCall.firmware_version).toBeUndefined();
  });
});

// ─── handleHeartbeat() — rules engine hook (Task 2.2) ────────────────────────

describe('handleHeartbeat() — rules engine hook', () => {
  const logger = require('../../shared/logger');

  const STATUS_RULES = [
    {
      id: 'rule-status-1',
      tenant_id: TENANT_ID,
      name: 'Device Online Alert',
      enabled: true,
      trigger_type: 'status',
      trigger_config: { status: 'online' },
      action_type: 'command',
      action_config: { action: 'notify', payload: { message: 'Device online' } },
      cooldown_ms: 60000,
      last_fired_at: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear any lingering timers between tests
    _timers.forEach((t, key) => {
      clearTimeout(t);
      _timers.delete(key);
    });
    // Do NOT use fake timers here — the rules engine hook uses real promises
    // that need the microtask queue to flush properly

    // Default: no rules exist
    rulesModel.findAllByTriggerType.mockResolvedValue([]);
    rulesEngine.evaluateStatusRules.mockReturnValue([]);
    rulesEngine.executeAction.mockResolvedValue({});
    devicesService.sendCommand.mockResolvedValue({ ok: true, topic: 'test/topic' });
    rulesModel.updateLastFired.mockResolvedValue({});
  });

  it('fetches status rules and evaluates them after successful heartbeat', async () => {
    devicesModel.update.mockResolvedValue({ id: DEVICE_ID });
    rulesModel.findAllByTriggerType.mockResolvedValue(STATUS_RULES);
    rulesEngine.evaluateStatusRules.mockReturnValue([
      { rule: STATUS_RULES[0], matchedStatus: 'online' },
    ]);
    rulesEngine.executeAction.mockResolvedValue({
      action: 'notify',
      payload: { message: 'Device online' },
    });

    await handleHeartbeat(TENANT_ID, DEVICE_ID, { status: 'online' });

    // Flush fire-and-forget promise
    await new Promise((resolve) => setImmediate(resolve));

    // Rules should be fetched for the correct tenant and trigger type
    expect(rulesModel.findAllByTriggerType).toHaveBeenCalledWith(TENANT_ID, 'status');

    // Rules engine should evaluate with the fetched rules
    expect(rulesEngine.evaluateStatusRules).toHaveBeenCalledWith(
      TENANT_ID,
      DEVICE_ID,
      'online',
      STATUS_RULES
    );

    // Action should be executed
    expect(rulesEngine.executeAction).toHaveBeenCalledWith(STATUS_RULES[0], TENANT_ID);
    expect(devicesService.sendCommand).toHaveBeenCalledWith(TENANT_ID, DEVICE_ID, {
      action: 'notify',
      payload: { message: 'Device online' },
    });

    // last_fired_at should be updated
    expect(rulesModel.updateLastFired).toHaveBeenCalledWith('rule-status-1', expect.any(Date));
  });

  it('does NOT evaluate rules when payload is null (malformed)', async () => {
    await handleHeartbeat(TENANT_ID, DEVICE_ID, null);

    await new Promise((resolve) => setImmediate(resolve));

    expect(rulesModel.findAllByTriggerType).not.toHaveBeenCalled();
    expect(rulesEngine.evaluateStatusRules).not.toHaveBeenCalled();
  });

  it('does NOT evaluate rules when no status rules exist', async () => {
    devicesModel.update.mockResolvedValue({ id: DEVICE_ID });
    rulesModel.findAllByTriggerType.mockResolvedValue([]);

    await handleHeartbeat(TENANT_ID, DEVICE_ID, { status: 'online' });

    await new Promise((resolve) => setImmediate(resolve));

    expect(rulesModel.findAllByTriggerType).toHaveBeenCalledWith(TENANT_ID, 'status');
    expect(rulesEngine.evaluateStatusRules).not.toHaveBeenCalled();
    expect(devicesService.sendCommand).not.toHaveBeenCalled();
  });

  it('handles rules engine errors gracefully without crashing heartbeat', async () => {
    devicesModel.update.mockResolvedValue({ id: DEVICE_ID });
    rulesModel.findAllByTriggerType.mockRejectedValue(new Error('DB error'));

    await handleHeartbeat(TENANT_ID, DEVICE_ID, { status: 'online' });

    await new Promise((resolve) => setImmediate(resolve));

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch status rules'),
      expect.any(Error)
    );
  });
});
