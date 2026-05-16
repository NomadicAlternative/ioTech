'use strict';

const { ForbiddenError } = require('../errors');

/**
 * Middleware: Restrict access to super-admins only.
 *
 * Dual-check strategy (safe deploy transition):
 *   1. req.user.role === 'super_admin' (DB-backed role via JWT)
 *   2. req.user.email is in SUPER_ADMIN_EMAILS env var (legacy)
 *
 * EITHER check passing grants access. This allows a safe rollout:
 * deploy the backend (with dual-check) BEFORE deploying the migration,
 * and deploy the migration BEFORE removing the env var.
 *
 * Must be used AFTER authGuard (req.user populated).
 *
 * Usage: router.use(authGuard, superAdmin);
 */
function superAdmin(req, res, next) {
  const user = req.user;

  // New role-based check
  if (user && user.role === 'super_admin') {
    return next();
  }

  // Legacy email-based check
  const adminEmails = (process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length > 0) {
    const userEmail = (user?.email || '').toLowerCase();
    if (adminEmails.includes(userEmail)) {
      return next();
    }
  }

  return next(new ForbiddenError('Super-admin access required'));
}

module.exports = superAdmin;
