'use strict';

const Joi = require('joi');

const update = Joi.object({
  name: Joi.string().min(1).max(120),
  contact_email: Joi.string().email(),
  metadata: Joi.object(),
});

module.exports = { update };
