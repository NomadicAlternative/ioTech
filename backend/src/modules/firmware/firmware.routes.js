'use strict';

const { Router } = require('express');
const firmwareService = require('./firmware.service');
const authGuard = require('../../shared/middleware/authGuard');
const tenantResolver = require('../../shared/middleware/tenantResolver');
const validate = require('../../shared/middleware/validate');
const schemas = require('./firmware.schemas');

const router = Router();

// ── Public routes (device-facing, no JWT) ────────────────────────────────

/**
 * GET /api/firmware/check
 * Device-facing endpoint — checks if a newer firmware version exists.
 * No auth required because ESP32 devices cannot hold JWTs.
 */
router.get('/check', validate(schemas.check, 'query'), async (req, res, next) => {
  try {
    const params = req.sanitizedQuery || req.query;
    const result = await firmwareService.checkLatest(params.current, params.hardware_model);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── Authenticated routes (dashboard-facing) ─────────────────────────────────
// Everything below this line requires a valid JWT and tenant context

router.use(authGuard, tenantResolver);

router.get('/', async (req, res, next) => {
  try {
    const data = await firmwareService.list(req.tenantId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const fw = await firmwareService.getById(req.tenantId, req.params.id);
    res.json({ data: fw });
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(schemas.create), async (req, res, next) => {
  try {
    const fw = await firmwareService.create(req.tenantId, req.body);
    res.status(201).json({ data: fw });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', validate(schemas.update), async (req, res, next) => {
  try {
    const fw = await firmwareService.update(req.tenantId, req.params.id, req.body);
    res.json({ data: fw });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await firmwareService.remove(req.tenantId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Also export a sub-router for the OTA endpoint so app.js can mount it at
// /api/devices/:id/ota while the rest of firmware routes stay at /api/firmware.
// This keeps OTA logic in the firmware module (per design decision).
const otaRouter = Router();
otaRouter.use(authGuard, tenantResolver);
otaRouter.post('/:id/ota', validate(schemas.triggerOta), async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await firmwareService.triggerOta(req.tenantId, req.params.id, body.version);
    res.status(202).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.otaRouter = otaRouter;
