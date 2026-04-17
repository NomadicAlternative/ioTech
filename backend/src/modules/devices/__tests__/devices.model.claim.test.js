'use strict';

/**
 * Unit tests for devices.model.js — findByClaimToken()
 * Tests are added to a new file to keep concerns isolated.
 */

jest.mock('../../../shared/db/knex', () => {
  const _mockFirst = jest.fn();
  const _chainable = {
    where: jest.fn().mockReturnThis(),
    first: _mockFirst,
  };
  const _db = jest.fn(() => _chainable);
  _db.__chainable = _chainable;
  _db.__mockFirst = _mockFirst;
  return _db;
});

const devicesModel = require('../devices.model');

let mockDb;
let chainable;
let mockFirst;

beforeAll(() => {
  mockDb = require('../../../shared/db/knex');
  chainable = mockDb.__chainable;
  mockFirst = mockDb.__mockFirst;
});

beforeEach(() => {
  jest.clearAllMocks();
  chainable.where.mockReturnThis();
});

describe('devicesModel.findByClaimToken()', () => {
  it('queries the devices table by claim_token', async () => {
    mockFirst.mockResolvedValue(null);

    await devicesModel.findByClaimToken('token-abc');

    expect(mockDb).toHaveBeenCalledWith('devices');
    expect(chainable.where).toHaveBeenCalledWith({ claim_token: 'token-abc' });
  });

  it('returns the device when the claim_token matches', async () => {
    const device = { id: 'device-uuid-1', claim_token: 'token-abc', status: 'unclaimed' };
    mockFirst.mockResolvedValue(device);

    const result = await devicesModel.findByClaimToken('token-abc');

    expect(result).toEqual(device);
  });

  it('returns undefined when no device matches the claim_token', async () => {
    mockFirst.mockResolvedValue(undefined);

    const result = await devicesModel.findByClaimToken('nonexistent-token');

    expect(result).toBeUndefined();
  });
});
