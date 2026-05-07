'use strict';

const Joi = require('joi');

// ─── Shared sub-schemas ───────────────────────────────────────────────────────

const VALID_TRIGGER_TYPES = ['threshold', 'status', 'battery_low'];
const VALID_ACTION_TYPES = ['relay', 'command', 'charging_start', 'charging_stop', 'low_power_mode'];
const VALID_OPERATORS = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'];

// ─── Conditional config validators ────────────────────────────────────────────

/**
 * Validate triggerConfig based on triggerType and actionConfig based on actionType.
 * This is a root-level custom validator that has access to all sibling fields.
 */
function validateConditionalConfig(value, helpers) {
  const { triggerType, triggerConfig, actionType, actionConfig } = value;

  // ── triggerConfig validation ──────────────────────────────────────────────
  if (triggerType && triggerConfig !== undefined) {
    if (triggerType === 'threshold') {
      const { error } = Joi.object({
        deviceId: Joi.string().uuid().optional(),
        datastreamKey: Joi.string().min(1).max(120).required(),
        operator: Joi.string()
          .valid(...VALID_OPERATORS)
          .required(),
        value: Joi.number().required(),
      }).validate(triggerConfig);

      if (error) {
        const msg = error.details.map((d) => d.message).join('; ');
        return helpers.error('any.custom', { message: `triggerConfig: ${msg}` });
      }
    }

    if (triggerType === 'status') {
      const { error } = Joi.object({
        deviceId: Joi.string().uuid().optional(),
        status: Joi.string().valid('online', 'offline').required(),
      }).validate(triggerConfig);

      if (error) {
        const msg = error.details.map((d) => d.message).join('; ');
        return helpers.error('any.custom', { message: `triggerConfig: ${msg}` });
      }
    }

    if (triggerType === 'battery_low') {
      const { error } = Joi.object({
        deviceId: Joi.string().uuid().optional(),
        field: Joi.string().min(1).max(120).default('battery_level'),
        threshold: Joi.number().min(0).max(100).required(),
      }).validate(triggerConfig);

      if (error) {
        const msg = error.details.map((d) => d.message).join('; ');
        return helpers.error('any.custom', { message: `triggerConfig: ${msg}` });
      }
    }
  }

  // ── actionConfig validation ───────────────────────────────────────────────
  if (actionType && actionConfig !== undefined) {
    if (actionType === 'relay') {
      const { error } = Joi.object({
        deviceId: Joi.string().uuid().optional(),
        relay: Joi.number().integer().min(1).max(8).required(),
        state: Joi.boolean().required(),
      }).validate(actionConfig);

      if (error) {
        const msg = error.details.map((d) => d.message).join('; ');
        return helpers.error('any.custom', { message: `actionConfig: ${msg}` });
      }
    }

    if (actionType === 'command') {
      const { error } = Joi.object({
        action: Joi.string().min(1).max(120).required(),
        payload: Joi.object().optional(),
      }).validate(actionConfig);

      if (error) {
        const msg = error.details.map((d) => d.message).join('; ');
        return helpers.error('any.custom', { message: `actionConfig: ${msg}` });
      }
    }

    if (['charging_start', 'charging_stop'].includes(actionType)) {
      const { error } = Joi.object({
        deviceId: Joi.string().uuid().required(),
      }).validate(actionConfig);

      if (error) {
        const msg = error.details.map((d) => d.message).join('; ');
        return helpers.error('any.custom', { message: `actionConfig: ${msg}` });
      }
    }

    if (actionType === 'low_power_mode') {
      const { error } = Joi.object({
        deviceId: Joi.string().uuid().required(),
        durationMinutes: Joi.number().integer().min(1).max(1440).optional(),
      }).validate(actionConfig);

      if (error) {
        const msg = error.details.map((d) => d.message).join('; ');
        return helpers.error('any.custom', { message: `actionConfig: ${msg}` });
      }
    }
  }

  return value;
}

// ─── Base field definitions ───────────────────────────────────────────────────

const baseFields = {
  name: Joi.string().min(1).max(255),
  description: Joi.string().max(1024).optional().allow('', null),
  enabled: Joi.boolean(),
  triggerType: Joi.string().valid(...VALID_TRIGGER_TYPES),
  triggerConfig: Joi.object(),
  actionType: Joi.string().valid(...VALID_ACTION_TYPES),
  actionConfig: Joi.object(),
  cooldownMs: Joi.number().integer().min(0),
};

// ─── Schemas ──────────────────────────────────────────────────────────────────

const create = Joi.object({
  ...baseFields,
  name: baseFields.name.required(),
  triggerType: baseFields.triggerType.required(),
  triggerConfig: baseFields.triggerConfig.required(),
  actionType: baseFields.actionType.required(),
  actionConfig: baseFields.actionConfig.required(),
  enabled: baseFields.enabled.optional().default(true),
  cooldownMs: baseFields.cooldownMs.optional().default(0),
}).custom(validateConditionalConfig, 'conditional config validation');

const update = Joi.object({
  ...baseFields,
}).custom(validateConditionalConfig, 'conditional config validation');

module.exports = { create, update };
