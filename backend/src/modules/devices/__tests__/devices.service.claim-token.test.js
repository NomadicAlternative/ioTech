'use strict';

/**
 * Unit tests for devices.service.js
 *   - create(): verifies claim_token is auto-generated alongside device_token
 *   - regenerateClaimToken(): happy path and error scenarios
 */

// ─── Mock: devices.model ─────────────────────────────────────────────────────
jest.mock('../devices.model');
const devicesModel = require('../devices.model');

// ─── Mock: shared/db/knex (minimal — only needed for module load) ──────────────
jest.mock('../../../shared/db/knex', () => {
  const _db = jest.fn(() => ({ where: jest.fn().mockReturnThis(), first: jest.fn() }));
  _db.fn = { now: jest.fn(() => 'NOW()') };
  return _db;
});

// ─── Mock: logger ─────────────────────────────────────────────────────────────
jest.mock('../../../shared/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// ─── Mock: mqttClient (prevent connection attempt on require) ──────────────
jest.mock('../../../mqtt/mqttClient', () => ({
  getClient: jest.fn(() => null),
}));

const { v4: uuidv4 } = require('uuid');
const devicesService = require('../devices.service');
const { NotFoundError } = require('../../../shared/errors');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-1';
const DEVICE_ID = 'device-uuid-1';

function makeDevice(overrides = {}) {
  return {
    id: DEVICE_ID,
    tenant_id: TENANT_ID,
    name: 'Sensor Alpha',
    status: 'unclaimed',
    device_token: 'device-tok-abc',
    claim_token: 'claim-tok-xyz',
    template_id: null,
    client_id: null,
    metadata: {},
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ─── create() — claim_token generation ────────────────────────────────────────

describe('devicesService.create() — claim_token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    devicesModel.insert.mockImplementation(async (data) => ({
      ...data,
      created_at: new Date(),
      updated_at: new Date(),
    }));
  });

  it('auto-generates a claim_token (UUID v4 format) on creation', async () => {
    await devicesService.create(TENANT_ID, { name: 'New Sensor' });

    expect(devicesModel.insert).toHaveBeenCalledTimes(1);
    const insertedData = devicesModel.insert.mock.calls[0][0];

    expect(insertedData.claim_token).toBeDefined();
    expect(insertedData.claim_token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('generates unique claim_token per device creation', async () => {
    await devicesService.create(TENANT_ID, { name: 'Device 1' });
    await devicesService.create(TENANT_ID, { name: 'Device 2' });

    const token1 = devicesModel.insert.mock.calls[0][0].claim_token;
    const token2 = devicesModel.insert.mock.calls[1][0].claim_token;
    expect(token1).not.toBe(token2);
  });

  it('also generates device_token alongside claim_token', async () => {
    await devicesService.create(TENANT_ID, { name: 'Dual Token Sensor' });

    const insertedData = devicesModel.insert.mock.calls[0][0];
    expect(insertedData.device_token).toBeDefined();
    expect(insertedData.claim_token).toBeDefined();
    expect(insertedData.device_token).not.toBe(insertedData.claim_token);
  });
});

// ─── regenerateClaimToken() ──────────────────────────────────────────────────

describe('devicesService.regenerateClaimToken()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates a new claim_token for an existing device', async () => {
    const device = makeDevice();
    devicesModel.findById.mockResolvedValue(device);

    const newToken = 'new-claim-tok-' + Date.now();
    devicesModel.update.mockImplementation(async (id, data) => ({
      ...device,
      ...data,
      updated_at: new Date(),
    }));

    // We'll verify the actual token format by checking the call args
    const result = await devicesService.regenerateClaimToken(TENANT_ID, DEVICE_ID);

    expect(devicesModel.findById).toHaveBeenCalledWith(TENANT_ID, DEVICE_ID);
    expect(devicesModel.update).toHaveBeenCalledWith(
      DEVICE_ID,
      expect.objectContaining({ claim_token: expect.any(String) })
    );

    // Verify the new token is a UUID v4
    const newClaimToken = devicesModel.update.mock.calls[0][1].claim_token;
    expect(newClaimToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );

    expect(result.claim_token).toBe(newClaimToken);
  });

  it('returns the full updated device record', async () => {
    const device = makeDevice();
    devicesModel.findById.mockResolvedValue(device);

    const updatedDevice = { ...device, claim_token: uuidv4(), updated_at: new Date() };
    devicesModel.update.mockResolvedValue(updatedDevice);

    const result = await devicesService.regenerateClaimToken(TENANT_ID, DEVICE_ID);

    expect(result).toMatchObject({
      id: DEVICE_ID,
      claim_token: updatedDevice.claim_token,
    });
  });

  it('throws NotFoundError when device does not belong to the tenant', async () => {
    devicesModel.findById.mockResolvedValue(null);

    await expect(
      devicesService.regenerateClaimToken(TENANT_ID, 'nonexistent-device')
    ).rejects.toThrow(NotFoundError);

    expect(devicesModel.update).not.toHaveBeenCalled();
  });

  it('generates a token different from the original claim_token', async () => {
    const device = makeDevice({ claim_token: 'original-token-value' });
    devicesModel.findById.mockResolvedValue(device);

    devicesModel.update.mockImplementation(async (id, data) => ({
      ...device,
      ...data,
      updated_at: new Date(),
    }));

    await devicesService.regenerateClaimToken(TENANT_ID, DEVICE_ID);

    const newToken = devicesModel.update.mock.calls[0][1].claim_token;
    expect(newToken).not.toBe('original-token-value');
  });
});


