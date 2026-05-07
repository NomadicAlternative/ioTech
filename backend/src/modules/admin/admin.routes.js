'use strict';

const { Router } = require('express');
const authGuard = require('../../shared/middleware/authGuard');
const superAdmin = require('../../shared/middleware/superAdmin');
const adminService = require('./admin.service');

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
router.get('/tenants', async (req, res, next) => {
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

module.exports = router;
