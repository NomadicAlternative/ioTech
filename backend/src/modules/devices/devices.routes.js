'use strict';

const { Router } = require('express');
const devicesService = require('./devices.service');
const authGuard = require('../../shared/middleware/authGuard');
const tenantResolver = require('../../shared/middleware/tenantResolver');

const validate = require('../../shared/middleware/validate');
const paginate = require('../../shared/middleware/paginate');
const schemas = require('./devices.schemas');

const router = Router();

// All devices routes require authentication + tenant scoping
router.use(authGuard, tenantResolver);

/**
 * @openapi
 * /api/devices:
 *   get:
 *     summary: List all devices for the authenticated tenant
 *     tags:
 *       - Devices
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *         description: Items per page (max 100)
 *       - in: query
 *         name: sortBy
 *         schema: { type: string }
 *         description: Field to sort by
 *       - in: query
 *         name: sortDir
 *         schema: { type: string, enum: [asc, desc], default: asc }
 *         description: Sort direction
 *     responses:
 *       200:
 *         description: Paginated list of devices
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Device'
 *                 meta:
 *                   $ref: '#/components/schemas/Meta'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', paginate(), async (req, res, next) => {
  try {
    const { data, total } = await devicesService.list(req.tenantId, req.pagination);
    const { page, limit } = req.pagination;
    res.json({
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/devices/{id}:
 *   get:
 *     summary: Get a single device by ID
 *     tags:
 *       - Devices
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Device ID
 *     responses:
 *       200:
 *         description: Device found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Device'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Device not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   put:
 *     summary: Update an existing device
 *     tags:
 *       - Devices
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Device ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, minLength: 1, maxLength: 120 }
 *               templateId: { type: string, format: uuid }
 *               clientId: { type: string, format: uuid }
 *               metadata: { type: object }
 *     responses:
 *       200:
 *         description: Device updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Device'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Device not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     summary: Remove a device
 *     tags:
 *       - Devices
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Device ID
 *     responses:
 *       204:
 *         description: Device deleted
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Device not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/claim', validate(schemas.claim), async (req, res, next) => {
  try {
    const device = await devicesService.claimDevice(req.tenantId, req.body.claim_token);
    res.json({ data: device });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const device = await devicesService.getById(req.tenantId, req.params.id);
    res.json({ data: device });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/devices:
 *   post:
 *     summary: Create a new device
 *     tags:
 *       - Devices
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name: { type: string, minLength: 1, maxLength: 120 }
 *               templateId: { type: string, format: uuid }
 *               clientId: { type: string, format: uuid }
 *               metadata: { type: object }
 *     responses:
 *       201:
 *         description: Device created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Device'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', validate(schemas.create), async (req, res, next) => {
  try {
    const device = await devicesService.create(req.tenantId, req.body);
    res.status(201).json({ data: device });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', validate(schemas.update), async (req, res, next) => {
  try {
    const device = await devicesService.update(req.tenantId, req.params.id, req.body);
    res.json({ data: device });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await devicesService.remove(req.tenantId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/devices/:id/command
 * Send a command to a device via MQTT.
 */
router.post('/:id/command', validate(schemas.command), async (req, res, next) => {
  try {
    const result = await devicesService.sendCommand(req.tenantId, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/devices/{id}/authenticate:
 *   post:
 *     summary: Device self-authentication via device token
 *     tags:
 *       - Devices
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Device ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - device_token
 *             properties:
 *               device_token: { type: string }
 *     responses:
 *       200:
 *         description: Device authenticated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Invalid device token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:id/authenticate', validate(schemas.authenticate), async (req, res, next) => {
  try {
    const result = await devicesService.authenticate(req.params.id, req.body.device_token);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * components:
 *   schemas:
 *     Device:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string }
 *         tenantId: { type: string, format: uuid }
 *         templateId: { type: string, format: uuid, nullable: true }
 *         clientId: { type: string, format: uuid, nullable: true }
 *         metadata: { type: object, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */

/**
 * GET /api/devices/:id/provisioning-credentials
 * Returns device_token, backend_url, and mqtt_url for the Web Serial provisioning flow.
 */
router.get('/:id/provisioning-credentials', async (req, res, next) => {
  try {
    const credentials = await devicesService.getProvisioningCredentials(req.tenantId, req.params.id);
    res.json({ data: credentials });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
