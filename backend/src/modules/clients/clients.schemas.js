'use strict';

const Joi = require('joi');

const create = Joi.object({
  name: Joi.string().min(1).max(120).required(),
  contact_email: Joi.string().email(),
  metadata: Joi.object(),
});

const update = Joi.object({
  name: Joi.string().min(1).max(120),
  contact_email: Joi.string().email(),
  metadata: Joi.object(),
});

module.exports = { create, update };
