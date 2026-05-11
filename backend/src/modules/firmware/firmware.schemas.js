'use strict';

const Joi = require('joi');

const create = Joi.object({
  version: Joi.string().max(20).required(),
  hardware_model: Joi.string().max(100).required(),
  release_notes: Joi.string().allow('', null),
  download_url: Joi.string().uri().required(),
});

const update = Joi.object({
  version: Joi.string().max(20),
  hardware_model: Joi.string().max(100),
  release_notes: Joi.string().allow('', null),
  download_url: Joi.string().uri(),
});

const check = Joi.object({
  current: Joi.string().max(20).optional(),
  hardware_model: Joi.string().max(100).required(),
});

const triggerOta = Joi.object({
  version: Joi.string().max(20).optional(),
});

module.exports = { create, update, check, triggerOta };
