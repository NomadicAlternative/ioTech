'use strict';

const Joi = require('joi');

/**
 * Validation for GET /api/admin/dashboard query parameters.
 * Currently no query params required, but schema exists for future extensibility.
 */
const dashboardQuery = Joi.object({}).unknown(false);

/**
 * Validation for GET /api/admin/tenants/:id route params.
 */
const tenantIdParams = Joi.object({
  id: Joi.string().uuid().required(),
});

module.exports = { dashboardQuery, tenantIdParams };
