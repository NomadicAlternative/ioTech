'use strict';

/**
 * Unit tests for devices.service.js
 *
 * Focuses on:
 *   - authenticate(): valid/invalid device_token scenarios
 *   - create(): verifies device_token is auto-generated
 *
 * All DB/model dependencies are mocked.
 */

// ─── Mock: devices.model ─────────────────────────────────────────────────────
jest.mock('../devices.model');
const devicesModel = require('../devices.model');

// ─── Mock: shared/db/knex ─────────────────────────────────────────────────────
// devices.service uses db directly for authenticate() — bypass model
//
// NOTE: jest.mock() is hoisted to the top of the file by Jest's transform.
// Any variables referenced inside the factory must be defined INSIDE the
// factory itself (closure over module scope causes TDZ errors).
// We expose the chainable sub-mocks via module-level variables that are
// assigned inside a beforeAll so tests can still control them.

let mockFirst;
let chainableMock;
let mockDb;

jest.mock('../../../shared/db/knex', () => {
  // These are created fresh the first time the module factory runs.
  // Tests interact with them via the module-level references set in beforeAll.
  const _mockFirst = jest.fn();
  const _chainable = {
    where: jest.fn().mockReturnThis(),
    first: _mockFirst,
  };
  const _db = jest.fn(() => _chainable);

  // Expose them on the function so beforeAll can grab a reference.
  _db.__mockFirst = _mockFirst;
  _db.__chainable = _chainable;

  return _db;
});

// ─── Mock: logger ─────────────────────────────────────────────────────────────
jest.mock('../../../shared/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const devicesService = require('../devices.service');
const { NotFoundError, UnauthorizedError } = require('../../../shared/errors');

// ─── Wire up mock references (must run after require, before tests) ───────────
beforeAll(() => {
  mockDb = require('../../../shared/db/knex');
  chainableMock = mockDb.__chainable;
  mockFirst = mockDb.__mockFirst;
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-1';
const DEVICE_ID = 'device-uuid-1';
const DEVICE_TOKEN = 'tok-abc-123-valid';

function makeDevice(overrides = {}) {
  return {
    id: DEVICE_ID,
    tenant_id: TENANT_ID,
    name: 'Sensor Alpha',
    status: 'active',
    device_token: DEVICE_TOKEN,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ─── authenticate() ───────────────────────────────────────────────────────────

describe('devicesService.authenticate()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chainableMock.where.mockReturnThis();
  });

  it('returns { ok: true, device } when device_token matches an active device', async () => {
    mockFirst.mockResolvedValue(makeDevice());

    const result = await devicesService.authenticate(DEVICE_ID, DEVICE_TOKEN);

    expect(mockDb).toHaveBeenCalledWith('devices');
    expect(chainableMock.where).toHaveBeenCalledWith({
      id: DEVICE_ID,
      device_token: DEVICE_TOKEN,
      status: 'active',
    });

    expect(result).toEqual({
      ok: true,
      device: expect.objectContaining({
        id: DEVICE_ID,
        device_token: DEVICE_TOKEN,
        status: 'active',
      }),
    });
  });

  it('throws UnauthorizedError when no device matches the token (invalid token)', async () => {
    mockFirst.mockResolvedValue(null);

    await expect(
      devicesService.authenticate(DEVICE_ID, 'invalid-token-xyz')
    ).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when device exists but is not active (inactive device)', async () => {
    // The where clause includes status:'active', so inactive device → null result
    mockFirst.mockResolvedValue(null);

    await expect(
      devicesService.authenticate(DEVICE_ID, DEVICE_TOKEN)
    ).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when device_id does not exist', async () => {
    mockFirst.mockResolvedValue(null);

    await expect(
      devicesService.authenticate('non-existent-device-id', DEVICE_TOKEN)
    ).rejects.toThrow(UnauthorizedError);
  });
});

// ─── create() ────────────────────────────────────────────────────────────────

describe('devicesService.create()', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    devicesModel.insert.mockImplementation(async (data) => ({
      ...data,
      created_at: new Date(),
      updated_at: new Date(),
    }));
  });

  it('inserts a device with an auto-generated device_token (UUID v4 format)', async () => {
    const _result = await devicesService.create(TENANT_ID, { name: 'New Sensor' });

    expect(devicesModel.insert).toHaveBeenCalledTimes(1);
    const insertedData = devicesModel.insert.mock.calls[0][0];

    // device_token must be present and look like a UUID
    expect(insertedData.device_token).toBeDefined();
    expect(insertedData.device_token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );

    // Two separate calls must generate DIFFERENT tokens (uniqueness)
    const _result2 = await devicesService.create(TENANT_ID, { name: 'Another Sensor' });
    const token1 = devicesModel.insert.mock.calls[0][0].device_token;
    const token2 = devicesModel.insert.mock.calls[1][0].device_token;
    expect(token1).not.toBe(token2);
  });

  it('sets status to "inactive" on creation', async () => {
    await devicesService.create(TENANT_ID, { name: 'Dormant Sensor' });

    const insertedData = devicesModel.insert.mock.calls[0][0];
    expect(insertedData.status).toBe('inactive');
  });

  it('sets tenant_id on the inserted record', async () => {
    await devicesService.create(TENANT_ID, { name: 'Tenanted Sensor' });

    const insertedData = devicesModel.insert.mock.calls[0][0];
    expect(insertedData.tenant_id).toBe(TENANT_ID);
  });

  it('passes through to model even when name is undefined (validation is at route layer)', async () => {
    // Validation moved to validate() middleware at route layer — service no longer guards
    await devicesService.create(TENANT_ID, {});
    expect(devicesModel.insert).toHaveBeenCalled();
  });

  it('returns the inserted device record', async () => {
    const result = await devicesService.create(TENANT_ID, { name: 'Result Sensor' });

    expect(result).toMatchObject({
      name: 'Result Sensor',
      tenant_id: TENANT_ID,
      status: 'inactive',
    });
  });
});

// ─── list() ───────────────────────────────────────────────────────────────────

describe('devicesService.list()', () => {
  it('delegates to devicesModel.findAll and count with tenantId, returns { data, total }', async () => {
    devicesModel.findAll.mockResolvedValue([makeDevice()]);
    devicesModel.count.mockResolvedValue(1);

    const result = await devicesService.list(TENANT_ID, { page: 1, limit: 20, sortBy: null, sortDir: 'asc' });

    expect(devicesModel.findAll).toHaveBeenCalledWith(TENANT_ID, expect.objectContaining({ page: 1, limit: 20 }));
    expect(devicesModel.count).toHaveBeenCalledWith(TENANT_ID);
    expect(result).toEqual({ data: [expect.objectContaining({ id: DEVICE_ID })], total: 1 });
  });
});

// ─── getById() ────────────────────────────────────────────────────────────────

describe('devicesService.getById()', () => {
  it('returns the device when it exists and belongs to the tenant', async () => {
    devicesModel.findById.mockResolvedValue(makeDevice());

    const result = await devicesService.getById(TENANT_ID, DEVICE_ID);

    expect(devicesModel.findById).toHaveBeenCalledWith(TENANT_ID, DEVICE_ID);
    expect(result).toMatchObject({ id: DEVICE_ID });
  });

  it('throws NotFoundError when device does not exist in the tenant', async () => {
    devicesModel.findById.mockResolvedValue(null);

    await expect(devicesService.getById(TENANT_ID, DEVICE_ID)).rejects.toThrow(NotFoundError);
  });
});
