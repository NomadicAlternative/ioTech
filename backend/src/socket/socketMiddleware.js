'use strict';

/**
 * Socket.io authentication middleware factory.
 *
 * Usage:
 *   io.use(createAuthMiddleware());
 *
 * On successful auth:
 *   - socket.data.userId and socket.data.tenantId are populated
 *   - socket is NOT disconnected
 *
 * On failure:
 *   - socket.disconnect(true) is called
 *   - next(error) is called with the auth error
 */

const { verifyToken } = require('../shared/middleware/authGuard');

/**
 * Creates a Socket.io connection middleware that validates the JWT
 * provided in the handshake auth payload.
 *
 * @returns {Function} Socket.io middleware (socket, next) => void
 */
function createAuthMiddleware() {
  return function authMiddleware(socket, next) {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      const decoded = verifyToken(token);

      socket.data.userId = decoded.userId || decoded.sub;
      socket.data.tenantId = decoded.tenantId || decoded.tenant_id;

      next();
    } catch (err) {
      socket.disconnect(true);
      next(err);
    }
  };
}

module.exports = { createAuthMiddleware };
