'use strict';

const Joi = require('joi');

const create = Joi.object({
  name: Joi.string().min(1).max(120).required(),
  templateId: Joi.string().uuid(),
  clientId: Joi.string().uuid(),
  metadata: Joi.object(),
});

const update = Joi.object({
  name: Joi.string().min(1).max(120),
  templateId: Joi.string().uuid(),
  clientId: Joi.string().uuid(),
  metadata: Joi.object(),
});

const authenticate = Joi.object({
  device_token: Joi.string().required(),
});

const claim = Joi.object({
  claim_token: Joi.string().min(1).required(),
});

const command = Joi.object({
  action: Joi.string().min(1).required(),
  payload: Joi.object(),
});

module.exports = { create, update, authenticate, claim, command };
