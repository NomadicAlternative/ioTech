'use strict';

/**
 * Unit tests for socketMiddleware.js — createAuthMiddleware()
 *
 * Tests JWT handshake auth:
 * - valid token → socket.data populated, socket NOT disconnected
 * - missing token → socket disconnected
 * - expired/invalid token → socket disconnected
 */

jest.mock('../../shared/middleware/authGuard');
const authGuard = require('../../shared/middleware/authGuard');

const { createAuthMiddleware } = require('../socketMiddleware');
const { UnauthorizedError } = require('../../shared/errors');

function makeSocket(token) {
  return {
    handshake: { auth: { token } },
    data: {},
    disconnect: jest.fn(),
  };
}

describe('createAuthMiddleware()', () => {
  let middleware;

  beforeEach(() => {
    jest.clearAllMocks();
    middleware = createAuthMiddleware();
  });

  it('populates socket.data and calls next() for a valid token', () => {
    const payload = { userId: 'u1', tenantId: 't1', email: 'u@t.com', role: 'installer' };
    authGuard.verifyToken.mockReturnValue(payload);

    const socket = makeSocket('valid.token');
    const next = jest.fn();

    middleware(socket, next);

    expect(authGuard.verifyToken).toHaveBeenCalledWith('valid.token');
    expect(socket.data.userId).toBe('u1');
    expect(socket.data.tenantId).toBe('t1');
    expect(next).toHaveBeenCalledWith();
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects socket and calls next(error) when token is missing', () => {
    authGuard.verifyToken.mockImplementation(() => {
      throw new UnauthorizedError('No token provided');
    });

    const socket = makeSocket(undefined);
    const next = jest.fn();

    middleware(socket, next);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('disconnects socket and calls next(error) when token is expired', () => {
    authGuard.verifyToken.mockImplementation(() => {
      throw new UnauthorizedError('Token has expired');
    });

    const socket = makeSocket('expired.token');
    const next = jest.fn();

    middleware(socket, next);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(socket.data.tenantId).toBeUndefined();
  });

  it('disconnects socket and calls next(error) for invalid/tampered token', () => {
    authGuard.verifyToken.mockImplementation(() => {
      throw new UnauthorizedError('Invalid token');
    });

    const socket = makeSocket('tampered.token');
    const next = jest.fn();

    middleware(socket, next);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
