'use strict';

const { Router } = require('express');
const telemetryService = require('./telemetry.service');
const authGuard = require('../../shared/middleware/authGuard');
const tenantResolver = require('../../shared/middleware/tenantResolver');

const router = Router();

router.use(authGuard, tenantResolver);

/**
 * GET /api/telemetry/devices/:deviceId/telemetry
 * Query telemetry data for a specific device.
 *
 * Query params:
 *   - from  (ISO 8601 date string) — start of time range
 *   - to    (ISO 8601 date string) — end of time range
 *   - limit (number, default 100, max 1000)
 */
router.get('/devices/:deviceId/telemetry', async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const { from, to, limit } = req.query;

    const rows = await telemetryService.query(req.tenantId, deviceId, {
      from,
      to,
      limit: limit ? Number(limit) : 100,
    });

    res.json({ data: rows, count: rows.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
