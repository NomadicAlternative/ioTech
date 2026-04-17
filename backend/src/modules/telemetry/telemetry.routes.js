'use strict';

const { Router } = require('express');
const telemetryService = require('./telemetry.service');
const authGuard = require('../../shared/middleware/authGuard');
const tenantResolver = require('../../shared/middleware/tenantResolver');

const validate = require('../../shared/middleware/validate');
const paginate = require('../../shared/middleware/paginate');
const schemas = require('./telemetry.schemas');

const router = Router();

router.use(authGuard, tenantResolver);

/**
 * @openapi
 * /api/telemetry/devices/{deviceId}/telemetry:
 *   get:
 *     summary: Query telemetry data for a specific device
 *     tags:
 *       - Telemetry
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Device ID
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *         description: Start of time range (ISO 8601)
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *         description: End of time range (ISO 8601)
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100, minimum: 1, maximum: 1000 }
 *         description: Maximum number of records to return
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number
 *       - in: query
 *         name: sortDir
 *         schema: { type: string, enum: [asc, desc], default: asc }
 *         description: Sort direction
 *     responses:
 *       200:
 *         description: Paginated telemetry data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TelemetryRecord'
 *                 meta:
 *                   $ref: '#/components/schemas/Meta'
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
 */
router.get('/devices/:deviceId/telemetry', validate(schemas.query, 'query'), paginate(), async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const { from, to, limit } = req.query;

    const { data, total } = await telemetryService.query(req.tenantId, deviceId, {
      from,
      to,
      limit: limit ? Number(limit) : req.pagination.limit,
      page: req.pagination.page,
      sortDir: req.pagination.sortDir,
    });

    const { page } = req.pagination;
    const pageLimit = limit ? Number(limit) : req.pagination.limit;
    res.json({
      data,
      meta: { page, limit: pageLimit, total, totalPages: Math.ceil(total / pageLimit) },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * components:
 *   schemas:
 *     TelemetryRecord:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         deviceId: { type: string, format: uuid }
 *         payload: { type: object }
 *         receivedAt: { type: string, format: date-time }
 */

module.exports = router;
