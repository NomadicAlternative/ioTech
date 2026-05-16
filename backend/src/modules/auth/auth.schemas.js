'use strict';

const Joi = require('joi');

const register = Joi.object({
  tenantId: Joi.string().uuid().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(1).required(),
  role: Joi.string().valid('super_admin', 'admin', 'installer'),
});

const login = Joi.object({
  tenantId: Joi.string().uuid().optional(),
  email: Joi.string().email().required(),
  password: Joi.string().min(1).required(),
});

// refresh token is now read from httpOnly cookie — no body required
const refresh = Joi.object({});

/**
 * Schema for installer self-registration.
 * Creates a tenant + admin user in one transaction.
 */
const installerRegister = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  contact_email: Joi.string().email(),
  metadata: Joi.object(),
});

const changePassword = Joi.object({
  currentPassword: Joi.string().min(1).required(),
  newPassword: Joi.string().min(8).required(),
});

const forgotPassword = Joi.object({
  email: Joi.string().email().required(),
});

module.exports = { register, login, refresh, installerRegister, changePassword, forgotPassword };
