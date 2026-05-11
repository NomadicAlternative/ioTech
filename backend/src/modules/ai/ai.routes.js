'use strict';

const { Router } = require('express');
const aiService = require('./ai.service');
const authGuard = require('../../shared/middleware/authGuard');
const tenantResolver = require('../../shared/middleware/tenantResolver');

const router = Router();

// All AI routes require authentication
router.use(authGuard, tenantResolver);

/**
 * POST /api/ai/configure
 * Generates device configuration from natural language description.
 *
 * Body: { prompt: "Tengo un ESP32 con DHT22, cuando 12°C activar relay 1..." }
 * Returns: { template, datastreams, pines, rules, diagrama }
 */
router.post('/configure', async (req, res, next) => {
  try {
    const { prompt } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'prompt is required', status: 400 },
      });
    }
    const config = await aiService.configure(prompt);
    res.json({ data: config });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/ai/apply
 * Apply the AI-generated config: create template, device, and rules.
 *
 * Body: { config: { template, datastreams, pines, rules } }
 * Returns: { template, device, rules, claim_token }
 */
router.post('/apply', async (req, res, next) => {
  try {
    const { config } = req.body;
    if (!config || !config.template) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'config with template is required', status: 400 },
      });
    }
    const result = await aiService.apply(req.tenantId, config);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
