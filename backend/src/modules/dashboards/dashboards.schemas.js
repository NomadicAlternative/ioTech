'use strict';

const Joi = require('joi');

// ── Widget schema ─────────────────────────────────────────────────────────────

const widgetSchema = Joi.object({
  id: Joi.string().required(),
  type: Joi.string().required(),
  name: Joi.string().required(),
  x: Joi.number().integer().min(0).required(),
  y: Joi.number().integer().min(0).required(),
  w: Joi.number().integer().min(1).required(),
  h: Joi.number().integer().min(1).required(),
  config: Joi.object({
    deviceId: Joi.string().uuid(),
    datastreamKey: Joi.string(),
    settings: Joi.object(),
  }).default({}),
});

const layoutSchema = Joi.object({
  widgets: Joi.array().items(widgetSchema).required(),
  gridConfig: Joi.object().required(),
});

// ── Module schemas ────────────────────────────────────────────────────────────

const createDashboard = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().allow('', null),
  layout: layoutSchema.invalid(null).default({ widgets: [], gridConfig: {} }),
});

const updateDashboard = Joi.object({
  name: Joi.string().min(1).max(255),
  description: Joi.string().allow('', null),
});

const updateLayout = Joi.object({
  layout: layoutSchema.required(),
});

const shareDashboard = Joi.object({
  clientId: Joi.string().uuid().required(),
});

module.exports = { createDashboard, updateDashboard, updateLayout, shareDashboard };
