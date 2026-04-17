'use strict';

const { Router } = require('express');
const provisioningService = require('./provisioning.service');
const validate = require('../../shared/middleware/validate');
const schemas = require('./provisioning.schemas');

const router = Router();

/**
 * @openapi
 * /api/provisioning:
 *   post:
 *     summary: Provision a device (unauthenticated — claim_token is the credential)
 *     tags:
 *       - Provisioning
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - claim_token
 *               - hardware_id
 *             properties:
 *               claim_token: { type: string }
 *               hardware_id: { type: string }
 *     responses:
 *       200:
 *         description: Provisioned — returns device_token and MQTT config
 *       400:
 *         description: Validation error
 *       404:
 *         description: claim_token not found
 *       409:
 *         description: Already provisioned
 *       422:
 *         description: hardware_id mismatch
 */
router.post('/', validate(schemas.provision), async (req, res, next) => {
  try {
    const result = await provisioningService.provision(req.body.claim_token, req.body.hardware_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
