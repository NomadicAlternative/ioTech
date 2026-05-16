'use strict';

const db = require('../db/knex');
const { ForbiddenError } = require('../errors');

/**
 * Middleware: Block requests from expired tenants.
 *
 * Checks the tenant's `status` column — if status is 'expired' AND the
 * requesting user is NOT super_admin, returns 403 Forbidden.
 *
 * Super-admin users ALWAYS bypass this check (TRIAL-005).
 * Users without a tenantId (e.g. auth/refresh routes) are also skipped.
 *
 * Must be used AFTER authGuard (req.user populated).
 *
 * Usage (in app.js): app.use('/api/devices', authGuard, trialExpiry, devicesRoutes);
 */
async function trialExpiry(req, res, next) {
  try {
    const user = req.user;

    // Skip check if no user context or no tenant association
    if (!user || !user.tenantId) {
      return next();
    }

    // Super admin bypasses ALL trial expiry checks
    if (user.role === 'super_admin') {
      return next();
    }

    // Look up tenant status
    const tenant = await db('tenants').where({ id: user.tenantId }).first();

    // If tenant doesn't exist or status is not expired, allow
    if (!tenant || tenant.status !== 'expired') {
      return next();
    }

    // Tenant is expired and user is not super_admin — block
    return next(new ForbiddenError('Tenant trial has expired'));
  } catch (err) {
    next(err);
  }
}

module.exports = trialExpiry;
