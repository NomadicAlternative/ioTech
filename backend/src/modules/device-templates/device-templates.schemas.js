'use strict';

const Joi = require('joi');

const create = Joi.object({
  name: Joi.string().min(1).max(120).required(),
  description: Joi.string(),
  datastreams: Joi.array().required(),
});

const update = Joi.object({
  name: Joi.string().min(1).max(120),
  description: Joi.string(),
  datastreams: Joi.array(),
});

module.exports = { create, update };
