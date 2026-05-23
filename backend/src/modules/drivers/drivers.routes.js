'use strict';

const express = require('express');
const router = express.Router();
const driverCatalogService = require('./driverCatalog.service');

/**
 * GET /api/drivers/catalog
 * Public endpoint — no auth required.
 *
 * Returns the full catalog of available sensors, actuators, and displays.
 * Each entry includes model, name, category, firmware status, description,
 * datastreams, and config schema.
 *
 * Query params:
 *   ?category=sensor|actuator|display
 *   ?status=available|untested|planned
 *
 * Response:
 *   { data: [...], meta: { total, available, untested, planned } }
 */
router.get('/catalog', async (req, res, next) => {
  try {
    const { category, status } = req.query;
    const filters = {};
    if (category) filters.category = category;
    if (status) filters.firmware_status = status;

    const catalog = await driverCatalogService.getCatalog(filters);
    const counts = {
      total: catalog.length,
      available: catalog.filter((d) => d.firmware_status === 'available').length,
      untested: catalog.filter((d) => d.firmware_status === 'untested').length,
      planned: catalog.filter((d) => d.firmware_status === 'planned').length,
    };

    res.json({ data: catalog, meta: counts });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
