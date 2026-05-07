'use strict';

/**
 * Unit tests for auth.service.installerRegister()
 *
 * Covers: happy path tenant+user creation, duplicate email checks,
 * validation errors, and token generation.
 */

// ─── Mock: auth.model ────────────────────────────────────────────────────────
jest.mock('../auth.model');
const authModel = require('../auth.model');

// ─── Mock: shared/db/knex ─────────────────────────────────────────────────────
//
// We need to mock:
//   1. db('tenants') for the duplicate email check in installerRegister
//   2. db.transaction() for the transactional tenant+user creation
//
// The chainable mock pattern lets db('tenants').where({ email }).first() work.

let mockFirst;
let chainableMock;
let mockDb;

jest.mock('../../../shared/db/knex', () => {
  const _mockFirst = jest.fn();
  const _chainable = {
    where: jest.fn().mockReturnThis(),
    first: _mockFirst,
    insert: jest.fn(),
  };
  const _db = jest.fn(() => _chainable);

  _db.__mockFirst = _mockFirst;
  _db.__chainable = _chainable;

  // db.transaction(cb) — calls cb with a mock trx that behaves like a Knex builder
  _db.transaction = jest.fn(async (cb) => {
    // trx is a function (just like db is a function) that returns a chainable builder
    const trxTableInsert = jest.fn().mockResolvedValue([{ id: 'mock-uuid' }]);
    const mockTrx = jest.fn(() => ({
      insert: trxTableInsert,
      where: jest.fn().mockReturnThis(),
      first: jest.fn(),
    }));
    return cb(mockTrx);
  });

  _db.fn = { now: jest.fn(() => 'NOW()') };

  return _db;
});

// ─── Mock: bcrypt ─────────────────────────────────────────────────────────────
jest.mock('bcrypt');
const bcrypt = require('bcrypt');

// ─── Mock: jsonwebtoken ───────────────────────────────────────────────────────
jest.mock('jsonwebtoken');
const jwt = require('jsonwebtoken');

// ─── Mock: logger ─────────────────────────────────────────────────────────────
jest.mock('../../../shared/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const authService = require('../auth.service');
const { ValidationError, ConflictError } = require('../../../shared/errors');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EMAIL = 'installer@example.com';
const PASSWORD = 'securePass1!';
const PASSWORD_HASH = '$2b$12$hashedpassword';
const ACCESS_TOKEN = 'mock.access.token';
const REFRESH_TOKEN_JWT = 'mock.refresh.token';

// ─── Wire up mock references ───────────────────────────────────────────────────
beforeAll(() => {
  mockDb = require('../../../shared/db/knex');
  chainableMock = mockDb.__chainable;
  mockFirst = mockDb.__mockFirst;
});

describe('authService.installerRegister()', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks: no existing user, no existing tenant
    authModel.findUserByEmailOnly.mockResolvedValue(null);
    mockFirst.mockResolvedValue(null);

    authModel.createRefreshToken.mockResolvedValue({});
    bcrypt.hash.mockResolvedValue(PASSWORD_HASH);
    jwt.sign
      .mockReturnValueOnce(ACCESS_TOKEN)   // access token
      .mockReturnValueOnce(REFRESH_TOKEN_JWT); // refresh token
  });

  it('creates a tenant + user in a transaction and returns tokens', async () => {
    const result = await authService.installerRegister({
      name: 'Test Installer',
      email: EMAIL,
      password: PASSWORD,
    });

    // Verify duplicate checks
    expect(authModel.findUserByEmailOnly).toHaveBeenCalledWith(EMAIL);

    // Verify transaction was used
    expect(mockDb.transaction).toHaveBeenCalled();

    // Verify refresh token stored
    expect(authModel.createRefreshToken).toHaveBeenCalled();

    // Verify output shape
    expect(result).toEqual({
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN_JWT,
      user: {
        id: expect.any(String),
        email: EMAIL,
        role: 'admin',
        tenantId: expect.any(String),
      },
      tenant: {
        id: expect.any(String),
        name: 'Test Installer',
        email: EMAIL,
      },
    });
  });

  it('accepts optional contact_email and metadata', async () => {
    const result = await authService.installerRegister({
      name: 'ACME Inc',
      email: EMAIL,
      password: PASSWORD,
      contact_email: 'contact@acme.com',
      metadata: { company: 'ACME Inc' },
    });

    expect(result.tenant.name).toBe('ACME Inc');
    expect(result.user.role).toBe('admin');
  });

  it('throws ConflictError when email is already used by a user', async () => {
    authModel.findUserByEmailOnly.mockResolvedValue({ id: 'existing-user' });

    await expect(
      authService.installerRegister({
        name: 'Test Installer',
        email: EMAIL,
        password: PASSWORD,
      })
    ).rejects.toThrow(ConflictError);

    // Should NOT attempt tenant table check
    expect(mockDb).not.toHaveBeenCalled();
  });

  it('throws ValidationError when email is invalid', async () => {
    await expect(
      authService.installerRegister({
        name: 'Test Installer',
        email: 'not-an-email',
        password: PASSWORD,
      })
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when password is too short', async () => {
    await expect(
      authService.installerRegister({
        name: 'Test Installer',
        email: EMAIL,
        password: 'short',
      })
    ).rejects.toThrow(ValidationError);
  });

  it('generates two different JWT tokens (access + refresh)', async () => {
    await authService.installerRegister({
      name: 'Test Installer',
      email: EMAIL,
      password: PASSWORD,
    });

    expect(jwt.sign).toHaveBeenCalledTimes(2);
    // First call: access token with user details + JWT_SECRET
    expect(jwt.sign).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userId: expect.any(String),
        tenantId: expect.any(String),
        email: EMAIL,
        role: 'admin',
      }),
      process.env.JWT_SECRET,
      expect.objectContaining({ expiresIn: expect.any(String) })
    );
    // Second call: refresh token with just userId + JWT_REFRESH_SECRET
    expect(jwt.sign).toHaveBeenNthCalledWith(
      2,
      { userId: expect.any(String) },
      process.env.JWT_REFRESH_SECRET,
      expect.objectContaining({ expiresIn: expect.any(String) })
    );
  });
});
