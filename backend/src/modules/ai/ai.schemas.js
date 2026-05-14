'use strict';

const Joi = require('joi');

/**
 * Schema contract between AI output and backend consumption.
 * Every field the AI generates MUST match this schema.
 * If validation fails, the AI output is rejected before touching the DB.
 */

const ruleCondition = Joi.object({
  datastream: Joi.string().required(),
  operator: Joi.string().valid('>', '>=', '<', '<=', '==', '!=').required(),
  value: Joi.number().required(),
});

const ruleAction = Joi.object({
  type: Joi.string().required(),  // accept any type — validated at execution time
  relay: Joi.number().integer().min(1).max(8),
  state: Joi.string().valid('on', 'off'),
  action: Joi.string(),
  payload: Joi.object(),
  angle: Joi.number().min(0).max(180),      // servo
  rgb: Joi.object({ r: Joi.number(), g: Joi.number(), b: Joi.number() }),  // LED
  text: Joi.string(),                        // display
  tone: Joi.number(),                        // buzzer
});

const rule = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow(''),
  condition: ruleCondition.required(),
  actions: Joi.array().items(ruleAction).min(1).required(),
  cooldown_seconds: Joi.number().integer().min(0).default(60),
});

const datastream = Joi.object({
  key: Joi.string().required(),
  name: Joi.string().required(),
  type: Joi.string().valid('number', 'string', 'boolean').required(),
  unit: Joi.string().allow('', null),
  direction: Joi.string().valid('input', 'output').required(),
});

const driver = Joi.object({
  model: Joi.string().required(),
  gpio: Joi.number().integer(),
  i2c_addr: Joi.string(),
  channels: Joi.array().items(Joi.object({
    num: Joi.number().integer().required(),
    gpio: Joi.number().integer().required(),
    name: Joi.string().required(),
  })),
});

const template = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow(''),
});

const aiConfig = Joi.object({
  template: template.required(),
  drivers: Joi.array().items(driver).default([]),
  datastreams: Joi.array().items(datastream).min(0).default([]),
  rules: Joi.array().items(rule).default([]),
  diagrama: Joi.string().allow(''),
});

/**
 * Validate AI-generated config against the contract.
 * @param {object} config — raw AI output
 * @returns {{ error?: string, value?: object }} — Joi-style result
 */
function validateAiConfig(config) {
  const { error, value } = aiConfig.validate(config, { abortEarly: false, stripUnknown: true });
  if (error) {
    const details = error.details.map(d => `${d.path.join('.')}: ${d.message}`);
    return { error: `AI config validation failed:\n- ${details.join('\n- ')}` };
  }
  return { value };
}

module.exports = { validateAiConfig };
