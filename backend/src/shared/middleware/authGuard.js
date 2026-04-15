'use strict';

const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('../errors');

/**
 * JWT authentication guard middleware.
 *
 * Reads the Authorization header (`Bearer <token>`), verifies the JWT,
 * and sets `req.user` with the decoded payload: { userId, tenantId, email, role }.
 *
 * Throws UnauthorizedError if the token is missing, malformed, or expired.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function authGuard(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or malformed Authorization header');
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix

    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is not configured');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Token has expired');
      }
      if (jwtErr.name === 'JsonWebTokenError') {
        throw new UnauthorizedError('Invalid token');
      }
      throw new UnauthorizedError('Token verification failed');
    }

    // Normalise JWT payload — support both 'sub' and 'userId' claims
    req.user = {
      userId: decoded.userId || decoded.sub,
      tenantId: decoded.tenantId || decoded.tenant_id,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = authGuard;
