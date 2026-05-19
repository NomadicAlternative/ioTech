'use strict';

/**
 * Base application error class.
 * All domain errors extend this so errorHandler can distinguish known vs unknown errors.
 */
class AppError extends Error {
  /**
   * @param {string} message   - Human-readable message
   * @param {number} statusCode - HTTP status code
   * @param {string} code       - Machine-readable error code (e.g. 'NOT_FOUND')
   */
  constructor(message, statusCode, code) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // Safe to expose to client

    // Maintain a proper stack trace in Node.js
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/** 404 — Resource not found */
class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

/** 400 — Request validation failed */
class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

/** 401 — No valid credentials provided */
class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/** 403 — Credentials valid but not allowed to access the resource */
class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

/** 409 — Conflict (e.g. duplicate email) */
class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409, 'CONFLICT');
  }
}

/** 422 — Unprocessable entity (semantic validation failure, e.g. datastream schema errors) */
class UnprocessableEntityError extends AppError {
  constructor(message = 'Unprocessable entity') {
    super(message, 422, 'UNPROCESSABLE_ENTITY');
  }
}

/** 429 — Too many requests (rate limit) */
class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

module.exports = {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  UnprocessableEntityError,
  TooManyRequestsError,
};
