'use strict';

/**
 * Unit tests for paginated list() in devices.service.js
 */

jest.mock('../devices.model');
const devicesModel = require('../devices.model');

jest.mock('../../../shared/db/knex', () => {
  const _mockFirst = jest.fn();
  const _chainable = {
    where: jest.fn().mockReturnThis(),
    first: _mockFirst,
    update: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
  };
  const _db = jest.fn(() => _chainable);
  _db.fn = { now: jest.fn(() => 'NOW()') };
  _db.__chainable = _chainable;
  _db.__mockFirst = _mockFirst;
  return _db;
});

jest.mock('../../../shared/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const devicesService = require('../devices.service');

const TENANT_ID = 'tenant-uuid-paginate';
const PAGINATION = { page: 1, limit: 20, sortBy: null, sortDir: 'asc' };

describe('devicesService.list() with pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls findAll and count in parallel and returns { data, total } with camelized devices', async () => {
    const rawDevices = [{ id: 'd1' }, { id: 'd2' }];
    devicesModel.findAll.mockResolvedValue(rawDevices);
    devicesModel.count.mockResolvedValue(45);

    const result = await devicesService.list(TENANT_ID, { pagination: PAGINATION });

    expect(devicesModel.findAll).toHaveBeenCalledWith(TENANT_ID, PAGINATION, undefined);
    expect(devicesModel.count).toHaveBeenCalledWith(TENANT_ID, undefined);
    expect(result.total).toBe(45);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toMatchObject({ id: 'd1' });
  });

  it('passes pagination object to findAll', async () => {
    const pagination = { page: 2, limit: 10, sortBy: 'name', sortDir: 'desc' };
    devicesModel.findAll.mockResolvedValue([]);
    devicesModel.count.mockResolvedValue(0);

    await devicesService.list(TENANT_ID, { pagination });

    expect(devicesModel.findAll).toHaveBeenCalledWith(TENANT_ID, pagination, undefined);
  });

  it('returns total of 0 when no devices exist', async () => {
    devicesModel.findAll.mockResolvedValue([]);
    devicesModel.count.mockResolvedValue(0);

    const result = await devicesService.list(TENANT_ID, { pagination: PAGINATION });

    expect(result).toEqual({ data: [], total: 0 });
  });
});
