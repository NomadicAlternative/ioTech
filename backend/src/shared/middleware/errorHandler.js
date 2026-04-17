'use strict';

const { AppError } = require('../errors');

/**
 * Centralized Express error handling middleware.
 * Must be registered LAST — after all routes and other middleware.
 *
 * Produces a consistent JSON response shape:
 *   { error: { code, message, status } }
 *
 * Known (operational) errors are returned as-is.
 * Unknown errors return a generic 500 (with details in development).
 *
 * @param {Error}          err
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Always log the error
  console.error(`[errorHandler] ${err.name || 'Error'}: ${err.message}`, {
    path: req.path,
    method: req.method,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  });

  if (err instanceof AppError && err.isOperational) {
    // Known, safe-to-expose error
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        status: err.statusCode,
        ...(err.details && { details: err.details }),
      },
    });
  }

  // Unknown / programming error
  const isDev = process.env.NODE_ENV === 'development';

  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isDev ? err.message : 'Internal server error',
      status: 500,
      ...(isDev && { stack: err.stack }),
    },
  });
}

module.exports = errorHandler;
