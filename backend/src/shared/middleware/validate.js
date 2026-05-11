'use strict';

const { ValidationError } = require('../errors');

/**
 * Middleware factory that validates req[target] against a Joi schema.
 *
 * @param {import('joi').Schema} schema  - Joi schema to validate against
 * @param {'body'|'query'|'params'} [target='body'] - which part of req to validate
 * @returns {import('express').RequestHandler}
 */
function validate(schema, target = 'body') {
  return function validationMiddleware(req, res, next) {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
      }));
      return next(new ValidationError('Validation failed', details));
    }

    // Replace req[target] with the Joi-sanitized (stripped) value.
    // For 'query', Express 5 makes req.query a read-only getter, so we
    // attach the sanitized values to req.sanitizedQuery instead.
    if (target === 'query') {
      req.sanitizedQuery = value;
    } else {
      req[target] = value;
    }
    return next();
  };
}

module.exports = validate;
