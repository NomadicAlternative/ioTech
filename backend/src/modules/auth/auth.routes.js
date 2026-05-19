'use strict';

const { Router } = require('express');
const authService = require('./auth.service');
const { loginLimiter, registerLimiter, refreshLimiter, logoutLimiter } = require('./rateLimiter');

const router = Router();

/**
 * POST /api/auth/register
 * Body: { tenantId, email, password, role? }
 */
router.post('/register', registerLimiter, async (req, res, next) => {
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
router.post('/login', loginLimiter, async (req, res, next) => {
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
router.post('/refresh', refreshLimiter, async (req, res, next) => {
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
router.post('/logout', logoutLimiter, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
