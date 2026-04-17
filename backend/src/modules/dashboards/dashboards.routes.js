'use strict';

const { Router } = require('express');
const dashboardsService = require('./dashboards.service');
const authGuard = require('../../shared/middleware/authGuard');
const tenantResolver = require('../../shared/middleware/tenantResolver');
const validate = require('../../shared/middleware/validate');
const paginate = require('../../shared/middleware/paginate');
const schemas = require('./dashboards.schemas');

const router = Router();

// All dashboard routes require authentication + tenant scoping
router.use(authGuard, tenantResolver);

/**
 * GET /api/dashboards
 * List all dashboards for the authenticated tenant (paginated).
 */
router.get('/', paginate(), async (req, res, next) => {
  try {
    const { data, total } = await dashboardsService.list(req.tenantId, req.pagination);
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
 * POST /api/dashboards
 * Create a new dashboard.
 */
router.post('/', validate(schemas.createDashboard), async (req, res, next) => {
  try {
    const dashboard = await dashboardsService.create(req.tenantId, req.body);
    res.status(201).json({ data: dashboard });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/dashboards/:id
 * Get a single dashboard by ID.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const dashboard = await dashboardsService.getById(req.tenantId, req.params.id);
    res.json({ data: dashboard });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/dashboards/:id
 * Update name/description of a dashboard.
 */
router.put('/:id', validate(schemas.updateDashboard), async (req, res, next) => {
  try {
    const dashboard = await dashboardsService.update(req.tenantId, req.params.id, req.body);
    res.json({ data: dashboard });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/dashboards/:id
 * Delete a dashboard.
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await dashboardsService.remove(req.tenantId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/dashboards/:id/layout
 * Replace the layout of a dashboard (full replace, debounced by client).
 */
router.put('/:id/layout', validate(schemas.updateLayout), async (req, res, next) => {
  try {
    const dashboard = await dashboardsService.updateLayout(
      req.tenantId,
      req.params.id,
      req.body.layout
    );
    res.json({ data: dashboard });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/dashboards/:id/share
 * Share a dashboard with a client.
 */
router.post('/:id/share', validate(schemas.shareDashboard), async (req, res, next) => {
  try {
    const record = await dashboardsService.shareWithClient(
      req.tenantId,
      req.params.id,
      req.body.clientId
    );
    res.status(201).json({ data: record });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/dashboards/:id/share/:clientId
 * Revoke a client's access to a dashboard.
 */
router.delete('/:id/share/:clientId', async (req, res, next) => {
  try {
    await dashboardsService.revokeClientShare(
      req.tenantId,
      req.params.id,
      req.params.clientId
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
