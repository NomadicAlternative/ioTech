'use strict';

/**
 * Unit tests for devices.model.js — count() and paginated findAll()
 * withTenant is mocked to call the callback immediately with a chainable trx.
 */

// ─── Mock: shared/db/tenant-knex ────────────────────────────────────────────
jest.mock('../../../shared/db/tenant-knex');
const { withTenant } = require('../../../shared/db/tenant-knex');

// ─── Mock: shared/db/knex ────────────────────────────────────────────────────
jest.mock('../../../shared/db/knex', () => {
  const _mockFirst = jest.fn();
  const _chainable = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockResolvedValue(1),
    first: _mockFirst,
    then: jest.fn(),
  };
  const _db = jest.fn(() => _chainable);
  _db.fn = { now: jest.fn(() => 'NOW()') };
  _db.__chainable = _chainable;
  _db.__mockFirst = _mockFirst;
  return _db;
});

const devicesModel = require('../devices.model');

const TENANT_ID = 'tenant-uuid-1';

// Build a chainable trx mock for withTenant callbacks
function makeCountTrx(countVal) {
  const trx = jest.fn((_table) => ({
    where: jest.fn().mockReturnThis(),
    count: jest.fn().mockResolvedValue([{ count: String(countVal) }]),
  }));
  return trx;
}

describe('devicesModel.count()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls withTenant with the tenantId', async () => {
    const trxMock = makeCountTrx(5);
    withTenant.mockImplementation(async (tenantId, cb) => cb(trxMock));
    // count returns [{ count: '5' }]
    trxMock.mockImplementationOnce((_table) => ({
      where: jest.fn().mockReturnThis(),
      count: jest.fn().mockResolvedValue([{ count: '5' }]),
    }));

    await devicesModel.count(TENANT_ID);

    expect(withTenant).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
  });

  it('returns the numeric count value', async () => {
    withTenant.mockImplementation(async (tenantId, cb) => {
      const trx = jest.fn((_table) => ({
        where: jest.fn().mockReturnThis(),
        count: jest.fn().mockResolvedValue([{ count: '42' }]),
      }));
      return cb(trx);
    });

    const result = await devicesModel.count(TENANT_ID);

    expect(result).toBe(42);
  });

  it('returns 0 when no devices exist', async () => {
    withTenant.mockImplementation(async (tenantId, cb) => {
      const trx = jest.fn((_table) => ({
        where: jest.fn().mockReturnThis(),
        count: jest.fn().mockResolvedValue([{ count: '0' }]),
      }));
      return cb(trx);
    });

    const result = await devicesModel.count(TENANT_ID);

    expect(result).toBe(0);
  });
});

describe('devicesModel.findAll() with pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makeFindAllTrx(rows = []) {
    const offsetMock = jest.fn().mockResolvedValue(rows);
    const limitMock = jest.fn().mockReturnValue({ offset: offsetMock });
    const orderByMock = jest.fn().mockReturnValue({ limit: limitMock, offset: offsetMock });
    const whereMock = jest.fn().mockReturnValue({ orderBy: orderByMock });
    const trx = jest.fn((_table) => ({ where: whereMock }));
    return { trx, orderByMock, limitMock, offsetMock };
  }

  it('applies LIMIT and OFFSET based on page and limit', async () => {
    const { trx, limitMock, offsetMock } = makeFindAllTrx();
    withTenant.mockImplementation(async (tenantId, cb) => cb(trx));

    await devicesModel.findAll(TENANT_ID, { page: 2, limit: 10, sortBy: null, sortDir: 'asc' });

    expect(limitMock).toHaveBeenCalledWith(10);
    expect(offsetMock).toHaveBeenCalledWith(10); // (page-1) * limit = 1 * 10
  });

  it('applies ORDER BY when sortBy is provided', async () => {
    const { trx, orderByMock } = makeFindAllTrx();
    withTenant.mockImplementation(async (tenantId, cb) => cb(trx));

    await devicesModel.findAll(TENANT_ID, { page: 1, limit: 20, sortBy: 'name', sortDir: 'desc' });

    expect(orderByMock).toHaveBeenCalledWith('name', 'desc');
  });

  it('falls back to created_at desc when sortBy is null', async () => {
    const { trx, orderByMock } = makeFindAllTrx();
    withTenant.mockImplementation(async (tenantId, cb) => cb(trx));

    await devicesModel.findAll(TENANT_ID, { page: 1, limit: 20, sortBy: null, sortDir: 'asc' });

    expect(orderByMock).toHaveBeenCalledWith('created_at', 'desc');
  });

  it('computes correct OFFSET for page 3 with limit 5', async () => {
    const { trx, limitMock, offsetMock } = makeFindAllTrx();
    withTenant.mockImplementation(async (tenantId, cb) => cb(trx));

    await devicesModel.findAll(TENANT_ID, { page: 3, limit: 5, sortBy: null, sortDir: 'asc' });

    expect(limitMock).toHaveBeenCalledWith(5);
    expect(offsetMock).toHaveBeenCalledWith(10); // (3-1) * 5 = 10
  });
});
