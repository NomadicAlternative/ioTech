'use strict';

const { ValidationError } = require('../errors');

/**
 * Middleware factory that parses and validates pagination query params.
 * Attaches `req.pagination = { page, limit, sortBy, sortDir }`.
 *
 * - page: positive integer, default 1
 * - limit: positive integer, default 20, max 100 (clamped silently)
 * - sortBy: column name string, default null
 * - sortDir: 'asc' | 'desc', default 'asc'
 *
 * @returns {import('express').RequestHandler}
 */
function paginate() {
  return function paginateMiddleware(req, res, next) {
    const { page: rawPage, limit: rawLimit, sortBy = null, sortDir = 'asc' } = req.query;

    // Parse page
    let page = 1;
    if (rawPage !== undefined) {
      const parsed = Number(rawPage);
      if (!Number.isFinite(parsed) || isNaN(parsed)) {
        return next(new ValidationError('Invalid pagination params', [
          { field: 'page', message: '"page" must be a number' },
        ]));
      }
      page = Math.floor(parsed);
    }

    // Parse limit
    let limit = 20;
    if (rawLimit !== undefined) {
      const parsed = Number(rawLimit);
      if (!Number.isFinite(parsed) || isNaN(parsed)) {
        return next(new ValidationError('Invalid pagination params', [
          { field: 'limit', message: '"limit" must be a number' },
        ]));
      }
      // Clamp silently to max 100
      limit = Math.min(Math.floor(parsed), 100);
    }

    req.pagination = {
      page,
      limit,
      sortBy: sortBy || null,
      sortDir: sortDir === 'desc' ? 'desc' : 'asc',
    };

    return next();
  };
}

module.exports = paginate;
