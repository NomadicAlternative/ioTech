'use strict';

const { Router } = require('express');
const installersService = require('./installers.service');
const authGuard = require('../../shared/middleware/authGuard');
const tenantResolver = require('../../shared/middleware/tenantResolver');
const { ForbiddenError } = require('../../shared/errors');

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
 * GET /api/installers
 * List all installers. Admin only.
 */
router.get('/', adminOnly, async (req, res, next) => {
  try {
    const installers = await installersService.list();
    res.json({ data: installers });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/installers/:id
 * Get an installer/tenant by ID.
 * Non-admins can only see their own profile.
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

/**
 * PUT /api/installers/:id
 * Update an installer/tenant profile.
 * Non-admins can only update their own profile.
 */
router.put('/:id', async (req, res, next) => {
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

module.exports = router;
