'use strict';

const { UnauthorizedError } = require('../errors');

/**
 * Middleware: Restrict access to super-admins only.
 * Super-admins are identified by email, configured via
 * SUPER_ADMIN_EMAILS env var (comma-separated list).
 *
 * Must be used AFTER authGuard (req.user populated).
 *
 * Usage: router.use(authGuard, superAdmin);
 */
function superAdmin(req, res, next) {
  const adminEmails = (process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length === 0) {
    // No super-admins configured — block everything for safety
    return next(new UnauthorizedError('Super-admin access is not configured'));
  }

  const userEmail = (req.user?.email || '').toLowerCase();

  if (!adminEmails.includes(userEmail)) {
    return next(new UnauthorizedError('Super-admin access required'));
  }

  next();
}

module.exports = superAdmin;
