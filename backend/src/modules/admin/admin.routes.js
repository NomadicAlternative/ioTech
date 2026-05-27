'use strict';

const { Router } = require('express');
const authGuard = require('../../shared/middleware/authGuard');
const superAdmin = require('../../shared/middleware/superAdmin');
const adminService = require('./admin.service');
const adminSchemas = require('./admin.schemas');

const router = Router();

// All admin routes require auth + super-admin
router.use(authGuard, superAdmin);

/**
 * @openapi
 * /api/admin/tenants:
 *   get:
 *     summary: List all tenants (super-admin only)
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all tenants
 */
router.get('/tenants', async (_req, res, next) => {
  try {
    const tenants = await adminService.listTenants();
    res.json({ data: tenants });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/admin/tenants:
 *   post:
 *     summary: Create a new tenant + installer user (super-admin only)
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tenant and installer user created
 */
router.post('/tenants', async (req, res, next) => {
  try {
    const result = await adminService.createTenant(req.body);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/admin/tenants/{id}/reset-password:
 *   post:
 *     summary: Reset installer password for a tenant (super-admin only)
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successful — returns new credentials
 */
router.post('/tenants/:id/reset-password', async (req, res, next) => {
  try {
    const { password } = req.body;
    const result = await adminService.resetPassword(req.params.id, password);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/admin/dashboard:
 *   get:
 *     summary: Get cross-tenant KPI counts (super-admin only)
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard KPI data
 */
router.get('/dashboard', async (req, res, next) => {
  try {
    const { error } = adminSchemas.dashboardQuery.validate(req.query);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const data = await adminService.getDashboard();
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/admin/tenants/{id}:
 *   get:
 *     summary: Get tenant detail with device and user counts (super-admin only)
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Tenant detail with device/user counts
 *       404:
 *         description: Tenant not found
 */
router.get('/tenants/:id', async (req, res, next) => {
  try {
    const { error, value } = adminSchemas.tenantIdParams.validate(req.params);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const data = await adminService.getTenantDetail(value.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/admin/tenants/{id}:
 *   delete:
 *     summary: Delete a tenant and ALL associated data (super-admin only, IRREVERSIBLE)
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Tenant and all associated data deleted
 *       404:
 *         description: Tenant not found
 */
router.delete('/tenants/:id', async (req, res, next) => {
  try {
    const result = await adminService.deleteTenant(req.params.id);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/admin/system-health:
 *   get:
 *     summary: Get system health metrics (super-admin only)
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System health metrics with alert levels
 */
router.get('/system-health', async (_req, res, next) => {
  try {
    const data = await adminService.getSystemHealth();
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
