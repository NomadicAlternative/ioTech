'use strict';

const Joi = require('joi');

const create = Joi.object({
  name: Joi.string().min(1).max(120).required(),
  email: Joi.string().email().allow('', null),
  phone: Joi.string().max(30).allow('', null),
  address: Joi.string().max(255).allow('', null),
  contact_email: Joi.string().email().allow('', null),
  metadata: Joi.object(),
});

const update = Joi.object({
  name: Joi.string().min(1).max(120),
  email: Joi.string().email().allow('', null),
  phone: Joi.string().max(30).allow('', null),
  address: Joi.string().max(255).allow('', null),
  contact_email: Joi.string().email().allow('', null),
  metadata: Joi.object(),
});

module.exports = { create, update };
