'use strict';

/**
 * Unit tests for admin.service.js
 *
 * All external dependencies (knex db, uuid) are mocked so
 * these tests run without a real database.
 */

const { v4: uuidv4 } = require('uuid');

// ─── Mocks ─────────────────────────────────────────────────────────────────────
const mockQueryBuilder = () => ({
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockReturnThis(),
  first: jest.fn().mockResolvedValue(undefined),
  orderBy: jest.fn().mockReturnThis(),
  count: jest.fn().mockReturnThis(),
  insert: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(1),
  returning: jest.fn().mockReturnThis(),
});

/**
 * Create a mock transaction function that also acts as a query builder.
 * Knex transactions are functions: trx('table') returns a query builder.
 */
function createMockTrx() {
  const trx = jest.fn(() => mockQueryBuilder());
  trx.insert = jest.fn().mockResolvedValue(undefined);
  trx.raw = jest.fn();
  return trx;
}

const mockDb = jest.fn((table) => mockQueryBuilder());
mockDb.transaction = jest.fn();

jest.mock('../../../shared/db/knex', () => mockDb);
jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('mocked-hash') }));
jest.mock('../../../shared/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const adminService = require('../admin.service');
const { ConflictError, NotFoundError } = require('../../../shared/errors');

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeQueryBuilder(overrides = {}) {
  return {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(undefined),
    orderBy: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(1),
    returning: jest.fn().mockReturnThis(),
    ...overrides,
  };
}

// ─── getDashboard() ────────────────────────────────────────────────────────────

describe('adminService.getDashboard()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns cross-tenant KPI counts with data present', async () => {
    const qb1 = makeQueryBuilder({ first: jest.fn().mockResolvedValue({ count: '42' }) });
    const qb2 = makeQueryBuilder({ first: jest.fn().mockResolvedValue({ count: '15' }) });
    const qb3 = makeQueryBuilder({ first: jest.fn().mockResolvedValue({ count: '10' }) });
    const qb4 = makeQueryBuilder({ first: jest.fn().mockResolvedValue({ count: '3' }) });

    mockDb
      .mockReturnValueOnce(qb1)   // db('users')
      .mockReturnValueOnce(qb2)   // db('devices')
      .mockReturnValueOnce(qb3)   // db('devices').where(...)
      .mockReturnValueOnce(qb4);  // db('tenants')

    const result = await adminService.getDashboard();

    expect(result).toEqual({
      totalUsers: 42,
      totalDevices: 15,
      activeDevices: 10,
      totalTenants: 3,
    });

    // Verify queries bypass RLS — db is called directly, not through withTenant()
    expect(mockDb).toHaveBeenCalledWith('users');
    expect(mockDb).toHaveBeenCalledWith('devices');
    expect(mockDb).toHaveBeenCalledWith('tenants');
    expect(qb3.where).toHaveBeenCalledWith({ status: 'active' });
  });

  it('returns zeros when database is empty', async () => {
    const qb1 = makeQueryBuilder({ first: jest.fn().mockResolvedValue({ count: '0' }) });
    const qb2 = makeQueryBuilder({ first: jest.fn().mockResolvedValue({ count: '0' }) });
    const qb3 = makeQueryBuilder({ first: jest.fn().mockResolvedValue({ count: '0' }) });
    const qb4 = makeQueryBuilder({ first: jest.fn().mockResolvedValue({ count: '0' }) });

    mockDb
      .mockReturnValueOnce(qb1)
      .mockReturnValueOnce(qb2)
      .mockReturnValueOnce(qb3)
      .mockReturnValueOnce(qb4);

    const result = await adminService.getDashboard();

    expect(result).toEqual({
      totalUsers: 0,
      totalDevices: 0,
      activeDevices: 0,
      totalTenants: 0,
    });
  });

  it('returns NaN-safe defaults when count is null', async () => {
    const qb1 = makeQueryBuilder({ first: jest.fn().mockResolvedValue({ count: null }) });
    const qb2 = makeQueryBuilder({ first: jest.fn().mockResolvedValue({ count: null }) });
    const qb3 = makeQueryBuilder({ first: jest.fn().mockResolvedValue({ count: null }) });
    const qb4 = makeQueryBuilder({ first: jest.fn().mockResolvedValue({ count: null }) });

    mockDb
      .mockReturnValueOnce(qb1)
      .mockReturnValueOnce(qb2)
      .mockReturnValueOnce(qb3)
      .mockReturnValueOnce(qb4);

    const result = await adminService.getDashboard();

    expect(result).toEqual({
      totalUsers: 0,
      totalDevices: 0,
      activeDevices: 0,
      totalTenants: 0,
    });
  });
});

// ─── getTenantDetail() ─────────────────────────────────────────────────────────

describe('adminService.getTenantDetail()', () => {
  const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
  const MOCK_TENANT = {
    id: TENANT_ID,
    name: 'Test Tenant',
    email: 'test@example.com',
    status: 'trial',
    trial_ends_at: new Date(Date.now() + 86400000).toISOString(),
    plan: 'base',
    contact_email: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns tenant detail with device and user counts', async () => {
    const tenantQb = makeQueryBuilder({ first: jest.fn().mockResolvedValue(MOCK_TENANT) });
    const deviceCountQb = makeQueryBuilder({ first: jest.fn().mockResolvedValue({ count: '5' }) });
    const userCountQb = makeQueryBuilder({ first: jest.fn().mockResolvedValue({ count: '2' }) });

    mockDb
      .mockReturnValueOnce(tenantQb)      // db('tenants')
      .mockReturnValueOnce(deviceCountQb) // db('devices')
      .mockReturnValueOnce(userCountQb);  // db('users')

    const result = await adminService.getTenantDetail(TENANT_ID);

    expect(result).toMatchObject({
      id: TENANT_ID,
      name: 'Test Tenant',
      email: 'test@example.com',
      status: 'trial',
      plan: 'base',
      deviceCount: 5,
      userCount: 2,
    });
    expect(result).toHaveProperty('trial_ends_at');
    expect(result).toHaveProperty('created_at');
  });

  it('throws NotFoundError when tenant does not exist', async () => {
    const tenantQb = makeQueryBuilder({ first: jest.fn().mockResolvedValue(undefined) });
    mockDb.mockReturnValueOnce(tenantQb);

    await expect(adminService.getTenantDetail('nonexistent-id')).rejects.toThrow(NotFoundError);
  });

  it('returns zero counts when tenant has no devices or users', async () => {
    const tenantQb = makeQueryBuilder({ first: jest.fn().mockResolvedValue(MOCK_TENANT) });
    const deviceCountQb = makeQueryBuilder({ first: jest.fn().mockResolvedValue({ count: '0' }) });
    const userCountQb = makeQueryBuilder({ first: jest.fn().mockResolvedValue({ count: '0' }) });

    mockDb
      .mockReturnValueOnce(tenantQb)
      .mockReturnValueOnce(deviceCountQb)
      .mockReturnValueOnce(userCountQb);

    const result = await adminService.getTenantDetail(TENANT_ID);

    expect(result.deviceCount).toBe(0);
    expect(result.userCount).toBe(0);
  });
});

// ─── createTenant() — trial fields ─────────────────────────────────────────────

describe('adminService.createTenant()', () => {
  const TENANT_DATA = {
    name: 'New Installer',
    email: 'new@installer.com',
    password: 'securePass123',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mockDb to default query builder
    mockDb.mockReset();
    mockDb.transaction.mockReset();

    // For duplicate checks: no existing tenant or user
    const noTenant = makeQueryBuilder({ first: jest.fn().mockResolvedValue(undefined) });
    const noUser = makeQueryBuilder({ first: jest.fn().mockResolvedValue(undefined) });
    mockDb
      .mockReturnValueOnce(noTenant)  // db('tenants').where({ email })
      .mockReturnValueOnce(noUser);   // db('users').where({ email })

    // Transaction mock — trx is a function: trx('table_name') returns a query builder with .insert()
    const mockTrxRaw = jest.fn().mockReturnValue('NOW() + INTERVAL 3 days');
    const mockTrxInsert = jest.fn().mockResolvedValue(undefined);
    const mockTrx = jest.fn(() => ({
      insert: mockTrxInsert,
    }));
    mockTrx.raw = mockTrxRaw;
    mockDb.transaction.mockImplementation(async (callback) => callback(mockTrx));

    // Store references for assertions
    global.__mockTrxInsert = mockTrxInsert;
  });

  afterEach(() => {
    delete global.__mockTrxInsert;
  });

  it('includes trial fields when creating a tenant', async () => {
    const result = await adminService.createTenant(TENANT_DATA);

    // Verify the transaction insert includes trial fields
    expect(mockDb.transaction).toHaveBeenCalled();
    const trxInsert = global.__mockTrxInsert;
    expect(trxInsert).toHaveBeenCalledTimes(2);

    // First insert is the tenant — verify trial fields
    const tenantInsert = trxInsert.mock.calls[0][0];
    expect(tenantInsert).toMatchObject({
      name: 'New Installer',
      email: 'new@installer.com',
    });
    expect(tenantInsert).toHaveProperty('trial_ends_at');
    expect(tenantInsert).toHaveProperty('status', 'trial');
    expect(tenantInsert).toHaveProperty('plan', 'base');
  });

  it('returns tenant and credentials on success', async () => {
    const result = await adminService.createTenant(TENANT_DATA);

    expect(result).toHaveProperty('tenant');
    expect(result).toHaveProperty('credentials');
    expect(result.tenant).toMatchObject({
      name: 'New Installer',
      email: 'new@installer.com',
    });
    expect(result.tenant).toHaveProperty('id');
  });

  it('throws ConflictError when tenant email already exists', async () => {
    // Reset and setup duplicate tenant scenario
    mockDb.mockReset();
    const existingTenant = makeQueryBuilder({
      first: jest.fn().mockResolvedValue({ id: 'existing-id', email: 'new@installer.com' }),
    });
    mockDb.mockReturnValueOnce(existingTenant);

    await expect(adminService.createTenant(TENANT_DATA)).rejects.toThrow(ConflictError);
  });
});
