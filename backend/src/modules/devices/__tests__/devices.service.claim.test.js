'use strict';

/**
 * Unit tests for devices.service.js — claimDevice()
 * Covers: happy path, already claimed, unknown token.
 */

jest.mock('../devices.model');
jest.mock('../../../shared/db/knex', () => {
  const _db = jest.fn(() => ({ where: jest.fn().mockReturnThis(), first: jest.fn() }));
  _db.fn = { now: jest.fn(() => 'NOW()') };
  return _db;
});
jest.mock('../../../shared/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const devicesModel = require('../devices.model');
const devicesService = require('../devices.service');
const { NotFoundError, ConflictError } = require('../../../shared/errors');

const TENANT_ID = 'tenant-uuid-1';
const DEVICE_ID = 'device-uuid-1';
const CLAIM_TOKEN = 'claim-tok-abc';

function makeUnclaimed(overrides = {}) {
  return { id: DEVICE_ID, tenant_id: null, status: 'unclaimed', claim_token: CLAIM_TOKEN, claimed_at: null, ...overrides };
}

describe('devicesService.claimDevice()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the updated device on happy path when device is unclaimed', async () => {
    const device = makeUnclaimed();
    devicesModel.findByClaimToken.mockResolvedValue(device);
    devicesModel.update.mockResolvedValue({ ...device, status: 'claimed', tenant_id: TENANT_ID, claimed_at: new Date() });

    const result = await devicesService.claimDevice(TENANT_ID, CLAIM_TOKEN);

    expect(devicesModel.findByClaimToken).toHaveBeenCalledWith(CLAIM_TOKEN);
    expect(devicesModel.update).toHaveBeenCalledWith(
      DEVICE_ID,
      expect.objectContaining({ status: 'claimed', tenant_id: TENANT_ID })
    );
    expect(result.status).toBe('claimed');
  });

  it('throws NotFoundError when claim_token does not match any device', async () => {
    devicesModel.findByClaimToken.mockResolvedValue(null);

    await expect(devicesService.claimDevice(TENANT_ID, 'bad-token')).rejects.toThrow(NotFoundError);
  });

  it('throws ConflictError when device is already claimed', async () => {
    devicesModel.findByClaimToken.mockResolvedValue(makeUnclaimed({ status: 'claimed' }));

    await expect(devicesService.claimDevice(TENANT_ID, CLAIM_TOKEN)).rejects.toThrow(ConflictError);
  });

  it('throws ConflictError when device is active (already provisioned)', async () => {
    devicesModel.findByClaimToken.mockResolvedValue(makeUnclaimed({ status: 'active' }));

    await expect(devicesService.claimDevice(TENANT_ID, CLAIM_TOKEN)).rejects.toThrow(ConflictError);
  });
});
