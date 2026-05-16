'use strict';

/**
 * Unit tests for trialExpiry middleware.
 *
 * Tests: expired tenant blocks non-super_admin (403),
 * active tenant passes, super_admin always passes,
 * missing tenant returns appropriate error.
 */

jest.mock('../../../shared/db/knex', () => {
  const mockFirst = jest.fn();
  const mockWhere = jest.fn().mockReturnThis();
  const mockChainable = {
    where: mockWhere,
    first: mockFirst,
  };
  const mockDb = jest.fn(() => mockChainable);
  mockDb.__mockFirst = mockFirst;
  mockDb.__mockWhere = mockWhere;
  mockDb.__mockChainable = mockChainable;
  return mockDb;
});

describe('trialExpiry middleware', () => {
  let trialExpiry;
  let req;
  let res;
  let next;
  let mockDb;
  let mockFirst;
  const TENANT_ID = 't-001';

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    req = {
      user: { userId: 'u-1', tenantId: TENANT_ID, email: 'user@test.com', role: 'installer' },
    };
    res = {};
    next = jest.fn();

    // Re-acquire mock references after resetModules
    mockDb = require('../../../shared/db/knex');
    mockFirst = mockDb.__mockFirst;
  });

  it('calls next() when tenant status is active (non-SA user)', async () => {
    mockFirst.mockResolvedValue({ id: TENANT_ID, status: 'active', trial_ends_at: null });

    trialExpiry = require('../trialExpiry');
    await trialExpiry(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('calls next() when tenant status is trial and not expired (non-SA user)', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    mockFirst.mockResolvedValue({ id: TENANT_ID, status: 'trial', trial_ends_at: futureDate });

    trialExpiry = require('../trialExpiry');
    await trialExpiry(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns ForbiddenError for expired tenant when user is not super_admin', async () => {
    mockFirst.mockResolvedValue({
      id: TENANT_ID,
      status: 'expired',
      trial_ends_at: '2025-01-01T00:00:00Z',
    });

    trialExpiry = require('../trialExpiry');
    await trialExpiry(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ForbiddenError');
    expect(err.statusCode).toBe(403);
    expect(err.message).toMatch(/trial/i);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('calls next() for expired tenant when user IS super_admin', async () => {
    req.user.role = 'super_admin';
    mockFirst.mockResolvedValue({
      id: TENANT_ID,
      status: 'expired',
      trial_ends_at: '2025-01-01T00:00:00Z',
    });

    trialExpiry = require('../trialExpiry');
    await trialExpiry(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('calls next() when req.user has no tenantId (auth-only routes)', async () => {
    req.user.tenantId = null;

    trialExpiry = require('../trialExpiry');
    await trialExpiry(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
    expect(mockDb).not.toHaveBeenCalled();
  });

  it('calls next() when tenant is not found in DB', async () => {
    mockFirst.mockResolvedValue(null);

    trialExpiry = require('../trialExpiry');
    await trialExpiry(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('passes db errors to next()', async () => {
    const dbError = new Error('DB connection failed');
    mockFirst.mockRejectedValue(dbError);

    trialExpiry = require('../trialExpiry');
    await trialExpiry(req, res, next);

    expect(next).toHaveBeenCalledWith(dbError);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('calls next() for status=trial where trial_ends_at is past but status not expired', async () => {
    // Edge: tenant has status='trial' but trial_ends_at is past due
    // The middleware should ONLY check status === 'expired', not compute expiry
    mockFirst.mockResolvedValue({
      id: TENANT_ID,
      status: 'trial',
      trial_ends_at: '2024-01-01T00:00:00Z',
    });

    trialExpiry = require('../trialExpiry');
    await trialExpiry(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('calls next() when req.user is undefined', async () => {
    req.user = undefined;

    trialExpiry = require('../trialExpiry');
    await trialExpiry(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
    expect(mockDb).not.toHaveBeenCalled();
  });
});
