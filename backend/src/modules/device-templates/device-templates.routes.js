'use strict';

const { Router } = require('express');
const templatesService = require('./device-templates.service');
const authGuard = require('../../shared/middleware/authGuard');
const tenantResolver = require('../../shared/middleware/tenantResolver');

const validate = require('../../shared/middleware/validate');
const paginate = require('../../shared/middleware/paginate');
const schemas = require('./device-templates.schemas');

const router = Router();

router.use(authGuard, tenantResolver);

/**
 * @openapi
 * /api/device-templates:
 *   get:
 *     summary: List all device templates for the authenticated tenant
 *     tags:
 *       - Device Templates
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string }
 *       - in: query
 *         name: sortDir
 *         schema: { type: string, enum: [asc, desc], default: asc }
 *     responses:
 *       200:
 *         description: Paginated list of device templates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DeviceTemplate'
 *                 meta:
 *                   $ref: '#/components/schemas/Meta'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     summary: Create a new device template
 *     tags:
 *       - Device Templates
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
 *               - datastreams
 *             properties:
 *               name: { type: string, minLength: 1, maxLength: 120 }
 *               description: { type: string }
 *               datastreams:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Device template created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/DeviceTemplate'
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

/** GET /api/device-templates */
router.get('/', paginate(), async (req, res, next) => {
  try {
    const { data, total } = await templatesService.list(req.tenantId, req.pagination);
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
 * /api/device-templates/{id}:
 *   get:
 *     summary: Get a single device template by ID
 *     tags:
 *       - Device Templates
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Device template found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/DeviceTemplate'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Device template not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   put:
 *     summary: Update an existing device template
 *     tags:
 *       - Device Templates
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, minLength: 1, maxLength: 120 }
 *               description: { type: string }
 *               datastreams:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Device template updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/DeviceTemplate'
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
 *         description: Device template not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     summary: Remove a device template
 *     tags:
 *       - Device Templates
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Device template deleted
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Device template not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/** GET /api/device-templates/:id */
router.get('/:id', async (req, res, next) => {
  try {
    const template = await templatesService.getById(req.tenantId, req.params.id);
    res.json({ data: template });
  } catch (err) {
    next(err);
  }
});

/** POST /api/device-templates */
router.post('/', validate(schemas.create), async (req, res, next) => {
  try {
    const template = await templatesService.create(req.tenantId, req.body);
    res.status(201).json({ data: template });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/device-templates/:id */
router.put('/:id', validate(schemas.update), async (req, res, next) => {
  try {
    const template = await templatesService.update(req.tenantId, req.params.id, req.body);
    res.json({ data: template });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/device-templates/:id */
router.delete('/:id', async (req, res, next) => {
  try {
    await templatesService.remove(req.tenantId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * components:
 *   schemas:
 *     DeviceTemplate:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string }
 *         description: { type: string, nullable: true }
 *         tenantId: { type: string, format: uuid }
 *         datastreams:
 *           type: array
 *           items:
 *             type: object
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */

module.exports = router;
