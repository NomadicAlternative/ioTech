'use strict';

const Joi = require('joi');

const register = Joi.object({
  tenantId: Joi.string().uuid().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(1).required(),
  role: Joi.string().valid('admin', 'installer'),
});

const login = Joi.object({
  tenantId: Joi.string().uuid().optional(),
  email: Joi.string().email().required(),
  password: Joi.string().min(1).required(),
});

const refresh = Joi.object({
  refreshToken: Joi.string().required(),
});

module.exports = { register, login, refresh };
