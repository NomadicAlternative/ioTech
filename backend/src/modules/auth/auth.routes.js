'use strict';

const { Router } = require('express');
const authService = require('./auth.service');

const router = Router();

/**
 * POST /api/auth/register
 * Body: { tenantId, email, password, role? }
 */
router.post('/register', async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Body: { tenantId, email, password }
 */
router.post('/login', async (req, res, next) => {
  try {
    const { tenantId, email, password } = req.body;
    const result = await authService.login(tenantId, email, password);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/refresh
 * Body: { refreshToken }
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refreshToken(refreshToken);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 * Body: { refreshToken }
 */
router.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
