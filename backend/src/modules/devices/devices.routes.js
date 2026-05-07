'use strict';

const { Router } = require('express');
const devicesService = require('./devices.service');
const authGuard = require('../../shared/middleware/authGuard');
const tenantResolver = require('../../shared/middleware/tenantResolver');

const router = Router();

// All devices routes require authentication + tenant scoping
router.use(authGuard, tenantResolver);

/**
 * GET /api/devices
 * List all devices for the authenticated tenant.
 * Query params:
 *   status  - optional: filter by device status (e.g. 'unclaimed', 'active')
 */
router.get('/', async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.status) {
      filters.status = req.query.status;
    }
    const devices = await devicesService.list(req.tenantId, filters);
    res.json({ data: devices });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/devices/:id
 * Get a single device by ID.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const device = await devicesService.getById(req.tenantId, req.params.id);
    res.json({ data: device });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/devices
 * Create a new device.
 * Body: { name, templateId?, clientId?, metadata? }
 */
router.post('/', async (req, res, next) => {
  try {
    const device = await devicesService.create(req.tenantId, req.body);
    res.status(201).json({ data: device });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/devices/:id
 * Update an existing device.
 */
router.put('/:id', async (req, res, next) => {
  try {
    const device = await devicesService.update(req.tenantId, req.params.id, req.body);
    res.json({ data: device });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/devices/:id
 * Remove a device.
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await devicesService.remove(req.tenantId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/devices/:id/authenticate
 * Device self-authentication via device_token.
 * Body: { device_token }
 */
router.post('/:id/authenticate', async (req, res, next) => {
  try {
    const result = await devicesService.authenticate(req.params.id, req.body.device_token);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/devices/:id/provisioning-credentials
 * Get provisioning credentials (claim_token + hardware_id) for an unclaimed device.
 * Used by the Web Serial provisioning flow on the frontend.
 */
router.get('/:id/provisioning-credentials', async (req, res, next) => {
  try {
    const credentials = await devicesService.getProvisioningCredentials(
      req.tenantId,
      req.params.id,
    );
    res.json({ data: credentials });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
