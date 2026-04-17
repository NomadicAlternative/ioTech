'use strict';

const { Router } = require('express');
const devicesService = require('../../modules/devices/devices.service');
const { UnauthorizedError } = require('../errors');

const router = Router();

/**
 * GET /internal/mqtt/auth
 * Called by EMQX HTTP authn webhook to authenticate device connections.
 * Query params: username={deviceId}, password={device_token}
 *
 * Response 200: { result: 'allow' }
 * Response 401: { result: 'deny' }
 */
router.get('/auth', async (req, res) => {
  const { username: deviceId, password: deviceToken } = req.query;

  if (!deviceId || !deviceToken) {
    return res.status(400).json({ result: 'deny', reason: 'username and password are required' });
  }

  try {
    await devicesService.authenticate(deviceId, deviceToken);
    return res.status(200).json({ result: 'allow' });
  } catch (err) {
    if (err instanceof UnauthorizedError || (err && err.statusCode === 401)) {
      return res.status(401).json({ result: 'deny' });
    }
    return res.status(500).json({ result: 'deny', reason: 'internal error' });
  }
});

module.exports = router;
