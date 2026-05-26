'use strict';

/**
 * Unit tests for provisioning.service.js
 * Covers: happy path, hardware_id mismatch, already provisioned (token nulled).
 */

jest.mock('../../devices/devices.model');
jest.mock('../../../shared/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const devicesModel = require('../../devices/devices.model');

// Import service after mocks
const provisioningService = require('../provisioning.service');
const { NotFoundError, UnprocessableEntityError } = require('../../../shared/errors');

const TENANT_ID = 'tenant-uuid-1';
const DEVICE_ID = 'device-uuid-1';
const CLAIM_TOKEN = 'claim-tok-abc';
const HARDWARE_ID = 'ESP32-ABC-001';

function makeClaimedDevice(overrides = {}) {
  return {
    id: DEVICE_ID,
    tenant_id: TENANT_ID,
    status: 'claimed',
    claim_token: CLAIM_TOKEN,
    hardware_id: HARDWARE_ID,
    device_token: null,
    ...overrides,
  };
}

describe('provisioningService.provision()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns device_token, mqtt_url, tenant_id on happy path', async () => {
    devicesModel.findByClaimToken.mockResolvedValue(makeClaimedDevice());
    devicesModel.update.mockImplementation(async (id, data) => ({
      ...makeClaimedDevice(),
      ...data,
    }));

    const result = await provisioningService.provision(CLAIM_TOKEN, HARDWARE_ID);

    expect(result).toMatchObject({
      tenant_id: TENANT_ID,
      device_id: DEVICE_ID,
    });
    expect(result.device_token).toBeDefined();
    expect(result.mqtt_url).toBeDefined();
  });

  it('sets device status to "active" and clears claim_token', async () => {
    devicesModel.findByClaimToken.mockResolvedValue(makeClaimedDevice());
    devicesModel.update.mockImplementation(async (id, data) => ({
      ...makeClaimedDevice(),
      ...data,
    }));

    await provisioningService.provision(CLAIM_TOKEN, HARDWARE_ID);

    expect(devicesModel.update).toHaveBeenCalledWith(
      DEVICE_ID,
      expect.objectContaining({ status: 'active', claim_token: null })
    );
  });

  it('throws NotFoundError when claim_token is not found (or already nulled)', async () => {
    devicesModel.findByClaimToken.mockResolvedValue(null);

    await expect(provisioningService.provision('bad-token', HARDWARE_ID)).rejects.toThrow(
      NotFoundError
    );
  });

  it('throws UnprocessableEntityError when hardware_id does not match', async () => {
    devicesModel.findByClaimToken.mockResolvedValue(makeClaimedDevice());

    await expect(provisioningService.provision(CLAIM_TOKEN, 'WRONG-HW-ID')).rejects.toThrow(
      UnprocessableEntityError
    );
  });

  it('returns existing token when device is already active (idempotent re-provisioning)', async () => {
    const existingDevice = makeClaimedDevice({
      status: 'active',
      device_token: 'existing-token-123',
    });
    devicesModel.findByClaimToken.mockResolvedValue(existingDevice);

    const result = await provisioningService.provision(CLAIM_TOKEN, HARDWARE_ID);

    expect(result.device_token).toBe('existing-token-123');
    expect(result.tenant_id).toBe(TENANT_ID);
    expect(result.device_id).toBe(DEVICE_ID);
  });
});
