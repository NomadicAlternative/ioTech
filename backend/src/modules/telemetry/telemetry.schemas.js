'use strict';

const Joi = require('joi');

const query = Joi.object({
  from: Joi.string().isoDate(),
  to: Joi.string().isoDate(),
  limit: Joi.number().integer().min(1).max(1000).default(100),
});

module.exports = { query };
