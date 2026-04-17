'use strict';

/**
 * Unit tests for verifyToken() — extracted pure function from authGuard.js
 *
 * Approval tests capture current jwt.verify behavior and ensure refactoring
 * doesn't change the semantics.
 */

jest.mock('jsonwebtoken');
const jwt = require('jsonwebtoken');

const { verifyToken } = require('../authGuard');

const SECRET = 'test-secret';
const PAYLOAD = { userId: 'u1', tenantId: 't1', email: 'u@t.com', role: 'installer' };

describe('verifyToken()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = SECRET;
  });

  it('returns decoded payload for a valid token', () => {
    jwt.verify.mockReturnValue(PAYLOAD);

    const result = verifyToken('valid.token.here');

    expect(jwt.verify).toHaveBeenCalledWith('valid.token.here', SECRET);
    expect(result).toEqual(PAYLOAD);
  });

  it('throws UnauthorizedError when token is missing', () => {
    const { UnauthorizedError } = require('../../errors');

    expect(() => verifyToken(undefined)).toThrow(UnauthorizedError);
    expect(() => verifyToken(null)).toThrow(UnauthorizedError);
    expect(() => verifyToken('')).toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when JWT is expired', () => {
    const { UnauthorizedError } = require('../../errors');
    const expiredErr = new Error('jwt expired');
    expiredErr.name = 'TokenExpiredError';
    jwt.verify.mockImplementation(() => { throw expiredErr; });

    expect(() => verifyToken('expired.token')).toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when JWT is invalid', () => {
    const { UnauthorizedError } = require('../../errors');
    const invalidErr = new Error('invalid signature');
    invalidErr.name = 'JsonWebTokenError';
    jwt.verify.mockImplementation(() => { throw invalidErr; });

    expect(() => verifyToken('tampered.token')).toThrow(UnauthorizedError);
  });
});
