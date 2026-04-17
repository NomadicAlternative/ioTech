'use strict';

const Joi = require('joi');

const provision = Joi.object({
  claim_token: Joi.string().min(1).required(),
  hardware_id: Joi.string().min(1).required(),
});

module.exports = { provision };
