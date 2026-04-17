'use strict';

/**
 * Unit tests for mqtt/handlers/heartbeat.js
 * Covers: last_seen update, malformed payload rejection.
 */

jest.mock('../../modules/devices/devices.model');
jest.mock('../../shared/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const devicesModel = require('../../modules/devices/devices.model');
const { handleHeartbeat } = require('../handlers/heartbeat');

const TENANT_ID = 'tenant-uuid-1';
const DEVICE_ID = 'device-uuid-1';

describe('handleHeartbeat()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls devicesModel.update with last_seen for a valid payload', async () => {
    devicesModel.update.mockResolvedValue({ id: DEVICE_ID, last_seen: new Date() });

    await handleHeartbeat(TENANT_ID, DEVICE_ID, { status: 'online' });

    expect(devicesModel.update).toHaveBeenCalledWith(
      DEVICE_ID,
      expect.objectContaining({ last_seen: expect.any(Date) })
    );
  });

  it('updates last_seen even when payload has extra fields', async () => {
    devicesModel.update.mockResolvedValue({ id: DEVICE_ID });

    await handleHeartbeat(TENANT_ID, DEVICE_ID, { status: 'online', battery: 82, temp: 24.5 });

    expect(devicesModel.update).toHaveBeenCalledTimes(1);
  });

  it('does NOT call devicesModel.update when payload is null (malformed)', async () => {
    await handleHeartbeat(TENANT_ID, DEVICE_ID, null);

    expect(devicesModel.update).not.toHaveBeenCalled();
  });

  it('does NOT call devicesModel.update when deviceId is missing', async () => {
    await handleHeartbeat(TENANT_ID, null, { status: 'online' });

    expect(devicesModel.update).not.toHaveBeenCalled();
  });
});
