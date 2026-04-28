'use strict';

/**
 * Unit tests for mqtt/handlers/heartbeat.js
 * Covers: last_seen + status update, offline timer, malformed payload rejection.
 */

jest.mock('../../modules/devices/devices.model');
jest.mock('../../shared/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../socket/socketServer');

const devicesModel = require('../../modules/devices/devices.model');
const { getSocketService } = require('../../socket/socketServer');
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

    // Should NOT have fired yet — timer reset to full 60s on second heartbeat
    expect(emitDeviceStatus).not.toHaveBeenCalled();
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
});
