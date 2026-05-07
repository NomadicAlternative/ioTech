'use strict';

/**
 * Unit tests for auth.service.js
 *
 * All external dependencies (knex db, bcrypt, jsonwebtoken) are mocked so
 * these tests run without a real database.
 */

// ─── Mock: auth.model ────────────────────────────────────────────────────────
jest.mock('../auth.model');
const authModel = require('../auth.model');

// ─── Mock: bcrypt ─────────────────────────────────────────────────────────────
jest.mock('bcrypt');
const bcrypt = require('bcrypt');

// ─── Mock: jsonwebtoken ───────────────────────────────────────────────────────
jest.mock('jsonwebtoken');
const jwt = require('jsonwebtoken');

// ─── Mock: logger (silences output during tests) ─────────────────────────────
jest.mock('../../../shared/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const authService = require('../auth.service');
const { ValidationError, UnauthorizedError, ConflictError } = require('../../../shared/errors');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-1';
const USER_ID = 'user-uuid-1';
const EMAIL = 'user@example.com';
const PASSWORD = 'securePass1!';
const PASSWORD_HASH = '$2b$12$hashedpassword';

function makeUser(overrides = {}) {
  return {
    id: USER_ID,
    tenant_id: TENANT_ID,
    email: EMAIL,
    password_hash: PASSWORD_HASH,
    role: 'installer',
    created_at: new Date(),
    ...overrides,
  };
}

// ─── register() ──────────────────────────────────────────────────────────────

describe('authService.register()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no existing user
    authModel.findUserByEmail.mockResolvedValue(null);
    authModel.createUser.mockResolvedValue(makeUser());
    bcrypt.hash.mockResolvedValue(PASSWORD_HASH);
  });

  it('creates a new user and returns sanitised user object', async () => {
    const result = await authService.register({
      tenantId: TENANT_ID,
      email: EMAIL,
      password: PASSWORD,
    });

    expect(authModel.findUserByEmail).toHaveBeenCalledWith(TENANT_ID, EMAIL);
    expect(bcrypt.hash).toHaveBeenCalledWith(PASSWORD, expect.any(Number));
    expect(authModel.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        email: EMAIL,
        passwordHash: PASSWORD_HASH,
        role: 'installer',
      })
    );

    expect(result).toEqual({
      user: expect.objectContaining({
        email: EMAIL,
        role: 'installer',
        tenantId: TENANT_ID,
      }),
    });
    // Password hash must NOT be returned
    expect(result.user.password_hash).toBeUndefined();
    expect(result.user.passwordHash).toBeUndefined();
  });

  it('throws ConflictError when email is already registered within the tenant', async () => {
    authModel.findUserByEmail.mockResolvedValue(makeUser());

    await expect(
      authService.register({ tenantId: TENANT_ID, email: EMAIL, password: PASSWORD })
    ).rejects.toThrow(ConflictError);
  });

  it('throws ValidationError when tenantId is missing', async () => {
    await expect(
      authService.register({ email: EMAIL, password: PASSWORD })
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when email format is invalid', async () => {
    await expect(
      authService.register({ tenantId: TENANT_ID, email: 'not-an-email', password: PASSWORD })
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when password is too short', async () => {
    await expect(
      authService.register({ tenantId: TENANT_ID, email: EMAIL, password: 'short' })
    ).rejects.toThrow(ValidationError);
  });
});

// ─── login() ─────────────────────────────────────────────────────────────────

describe('authService.login()', () => {
  const ACCESS_TOKEN = 'mock.access.token';
  const REFRESH_TOKEN_JWT = 'mock.refresh.token';

  beforeEach(() => {
    jest.clearAllMocks();
    authModel.findUserByEmail.mockResolvedValue(makeUser());
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign
      .mockReturnValueOnce(ACCESS_TOKEN)   // first call → access token
      .mockReturnValueOnce(REFRESH_TOKEN_JWT); // second call → refresh token
    authModel.createRefreshToken.mockResolvedValue({});
  });

  it('returns accessToken, refreshToken, and sanitised user on valid credentials', async () => {
    const result = await authService.login(TENANT_ID, EMAIL, PASSWORD);

    expect(authModel.findUserByEmail).toHaveBeenCalledWith(TENANT_ID, EMAIL);
    expect(bcrypt.compare).toHaveBeenCalledWith(PASSWORD, PASSWORD_HASH);
    expect(authModel.createRefreshToken).toHaveBeenCalled();

    expect(result).toEqual({
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN_JWT,
      user: expect.objectContaining({
        id: USER_ID,
        email: EMAIL,
        role: 'installer',
        tenantId: TENANT_ID,
      }),
    });
  });

  it('throws UnauthorizedError when user does not exist', async () => {
    authModel.findUserByEmail.mockResolvedValue(null);

    await expect(authService.login(TENANT_ID, EMAIL, PASSWORD)).rejects.toThrow(
      UnauthorizedError
    );
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedError when password is wrong', async () => {
    bcrypt.compare.mockResolvedValue(false);

    await expect(authService.login(TENANT_ID, EMAIL, PASSWORD)).rejects.toThrow(
      UnauthorizedError
    );
    expect(authModel.createRefreshToken).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedError when tenantId is missing and email is not found', async () => {
    // When tenantId is undefined, login resolves tenant from email alone.
    // If the email isn't found, it throws UnauthorizedError.
    authModel.findUserByEmailOnly.mockResolvedValue(null);

    await expect(authService.login(undefined, EMAIL, PASSWORD)).rejects.toThrow(
      UnauthorizedError
    );
  });
});

// ─── refreshToken() ──────────────────────────────────────────────────────────

describe('authService.refreshToken()', () => {
  const RAW_TOKEN = 'mock.refresh.token';
  const NEW_ACCESS_TOKEN = 'new.access.token';
  const STORED_TOKEN = {
    id: 'token-uuid',
    user_id: USER_ID,
    token: RAW_TOKEN,
    expires_at: new Date(Date.now() + 1000 * 60 * 60), // 1h in future
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // resetAllMocks clears queued mockReturnValueOnce values left by the
    // login() describe beforeEach — without this, stale enqueued values
    // bleed into the first jwt.sign call here and return the wrong token.
    jwt.sign.mockReset();
    jwt.verify.mockReturnValue({ userId: USER_ID });
    authModel.findRefreshToken.mockResolvedValue(STORED_TOKEN);
    authModel.findUserById.mockResolvedValue(makeUser());
    jwt.sign.mockReturnValue(NEW_ACCESS_TOKEN);
  });

  it('returns a new accessToken when refresh token is valid and not expired', async () => {
    const result = await authService.refreshToken(RAW_TOKEN);

    expect(jwt.verify).toHaveBeenCalledWith(RAW_TOKEN, process.env.JWT_REFRESH_SECRET);
    expect(authModel.findRefreshToken).toHaveBeenCalledWith(RAW_TOKEN);
    expect(authModel.findUserById).toHaveBeenCalledWith(USER_ID);
    expect(result).toEqual({ accessToken: NEW_ACCESS_TOKEN });
  });

  it('throws UnauthorizedError when JWT verification fails (invalid/expired)', async () => {
    jwt.verify.mockImplementation(() => {
      const err = new Error('jwt expired');
      err.name = 'TokenExpiredError';
      throw err;
    });

    await expect(authService.refreshToken(RAW_TOKEN)).rejects.toThrow(UnauthorizedError);
    expect(authModel.findRefreshToken).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedError when refresh token is not found in DB (revoked)', async () => {
    authModel.findRefreshToken.mockResolvedValue(null);

    await expect(authService.refreshToken(RAW_TOKEN)).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when stored token is past its expiry date', async () => {
    authModel.findRefreshToken.mockResolvedValue({
      ...STORED_TOKEN,
      expires_at: new Date(Date.now() - 1000), // 1s in the past
    });
    authModel.deleteRefreshToken = jest.fn().mockResolvedValue(1);

    await expect(authService.refreshToken(RAW_TOKEN)).rejects.toThrow(UnauthorizedError);
  });

  it('throws ValidationError when token argument is missing', async () => {
    await expect(authService.refreshToken(undefined)).rejects.toThrow(ValidationError);
  });
});

// ─── logout() ────────────────────────────────────────────────────────────────

describe('authService.logout()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authModel.deleteRefreshToken.mockResolvedValue(1);
  });

  it('deletes the refresh token from the database', async () => {
    await authService.logout('some.refresh.token');

    expect(authModel.deleteRefreshToken).toHaveBeenCalledWith('some.refresh.token');
  });

  it('throws ValidationError when token argument is missing', async () => {
    await expect(authService.logout(undefined)).rejects.toThrow(ValidationError);
    expect(authModel.deleteRefreshToken).not.toHaveBeenCalled();
  });
});
