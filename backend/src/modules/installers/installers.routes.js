'use strict';

const { Router } = require('express');
const installersService = require('./installers.service');
const authGuard = require('../../shared/middleware/authGuard');
const tenantResolver = require('../../shared/middleware/tenantResolver');
const { ForbiddenError } = require('../../shared/errors');

const validate = require('../../shared/middleware/validate');
const paginate = require('../../shared/middleware/paginate');
const schemas = require('./installers.schemas');

const router = Router();

router.use(authGuard, tenantResolver);

/**
 * Middleware: only allow users with role === 'admin'.
 */
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(new ForbiddenError('Admin access required'));
  }
  next();
}

/**
 * @openapi
 * /api/installers:
 *   get:
 *     summary: List all installers (admin only)
 *     tags:
 *       - Installers
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
 *         description: Paginated list of installers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Installer'
 *                 meta:
 *                   $ref: '#/components/schemas/Meta'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden — admin role required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', adminOnly, paginate(), async (req, res, next) => {
  try {
    const { data, total } = await installersService.list(req.pagination);
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
 * /api/installers/{id}:
 *   get:
 *     summary: Get an installer profile by ID
 *     description: Non-admins can only view their own profile.
 *     tags:
 *       - Installers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Installer profile found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Installer'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Installer not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   put:
 *     summary: Update an installer profile
 *     description: Non-admins can only update their own profile.
 *     tags:
 *       - Installers
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
 *               name: { type: string }
 *               contact_email: { type: string, format: email }
 *               metadata: { type: object }
 *     responses:
 *       200:
 *         description: Installer updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Installer'
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
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Installer not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', async (req, res, next) => {
  try {
    const installer = await installersService.getById(
      req.user.role,
      req.tenantId,
      req.params.id
    );
    res.json({ data: installer });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', validate(schemas.update), async (req, res, next) => {
  try {
    const installer = await installersService.update(
      req.user.role,
      req.tenantId,
      req.params.id,
      req.body
    );
    res.json({ data: installer });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * components:
 *   schemas:
 *     Installer:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string }
 *         contact_email: { type: string, format: email, nullable: true }
 *         metadata: { type: object, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */

module.exports = router;
