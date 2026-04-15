'use strict';

const { UnauthorizedError } = require('../errors');

/**
 * Tenant resolver middleware.
 *
 * MUST run AFTER authGuard — requires req.user to be populated.
 *
 * Reads `req.user.tenantId` (set by authGuard) and copies it to `req.tenantId`
 * so all downstream handlers and services can access it directly.
 *
 * Throws UnauthorizedError if tenantId is missing from the token.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function tenantResolver(req, res, next) {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required — run authGuard before tenantResolver');
    }

    const tenantId = req.user.tenantId;

    if (!tenantId) {
      throw new UnauthorizedError('No tenant associated with this token');
    }

    req.tenantId = tenantId;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = tenantResolver;
