'use strict';

/**
 * Auth rate limiter — factory + four configured middleware instances.
 *
 * Each endpoint gets its own independent window, limit, and key strategy.
 * Configuration via AUTH_RATE_LIMIT_* env vars with sensible defaults.
 *
 * Express-rate-limit v7, in-memory store.
 */

const rateLimit = require('express-rate-limit');
const { TooManyRequestsError } = require('../../shared/errors');

// ─── Key generators (exported for unit testing) ─────────────────────────────

/**
 * Login compound key: IP + tenantId from request body.
 * Fallback to "unknown" guards against clients omitting tenantId.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
function loginKeyGenerator(req) {
  return `${req.ip}:${req.body?.tenantId || 'unknown'}`;
}

/**
 * Simple IP-based key for register, refresh, logout.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
function ipKeyGenerator(req) {
  return req.ip;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a rate limiter middleware instance.
 *
 * @param {object} opts
 * @param {number} opts.windowMs      - Sliding window duration in milliseconds
 * @param {number} opts.max           - Max requests allowed in the window
 * @param {Function} opts.keyGenerator - (req) => string used as rate-limit key
 * @param {string} opts.name          - Human-readable name for debugging/logging
 * @returns {Function} Express middleware (req, res, next)
 */
function createLimiter({ windowMs, max, keyGenerator, name: _name }) {
  return rateLimit({
    windowMs,
    max,
    keyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => {
      // AUTH_RATE_LIMIT_ENABLED=false disables all rate limiting.
      // Any other value (or unset) keeps it enabled.
      return process.env.AUTH_RATE_LIMIT_ENABLED === 'false';
    },
    handler: (req, res, next) => {
      const retryAfter = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000);
      res.set('Retry-After', String(retryAfter));
      next(new TooManyRequestsError('Too many requests. Please try again later.'));
    },
  });
}

// ─── Configured middleware instances ─────────────────────────────────────────

const loginLimiter = createLimiter({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_LOGIN_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max: Number(process.env.AUTH_RATE_LIMIT_LOGIN_MAX) || 20,
  name: 'login',
  keyGenerator: loginKeyGenerator,
});

const registerLimiter = createLimiter({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_REGISTER_WINDOW_MS) || 60 * 60 * 1000, // 60 min
  max: Number(process.env.AUTH_RATE_LIMIT_REGISTER_MAX) || 10,
  name: 'register',
  keyGenerator: ipKeyGenerator,
});

const refreshLimiter = createLimiter({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_REFRESH_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max: Number(process.env.AUTH_RATE_LIMIT_REFRESH_MAX) || 30,
  name: 'refresh',
  keyGenerator: ipKeyGenerator,
});

const logoutLimiter = createLimiter({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_LOGOUT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max: Number(process.env.AUTH_RATE_LIMIT_LOGOUT_MAX) || 60,
  name: 'logout',
  keyGenerator: ipKeyGenerator,
});

module.exports = {
  loginKeyGenerator,
  ipKeyGenerator,
  loginLimiter,
  registerLimiter,
  refreshLimiter,
  logoutLimiter,
};
