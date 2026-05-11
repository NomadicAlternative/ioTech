'use strict';

const { v4: uuidv4 } = require('uuid');
const devicesModel = require('../devices/devices.model');
const logger = require('../../shared/logger');
const { NotFoundError, ConflictError, UnprocessableEntityError } = require('../../shared/errors');
const { getLocalIp } = require('../../shared/network');

function getMqttUrl() {
  const localIp = getLocalIp();
  return `mqtt://${localIp}:1883`;
}

/**
 * Exchange a claim_token + hardware_id for a permanent device_token and MQTT config.
 * This endpoint is unauthenticated — the claim_token IS the bootstrap credential.
 *
 * @param {string} claimToken
 * @param {string} hardwareId
 * @returns {Promise<{ device_token: string, mqtt_url: string, tenant_id: string, device_id: string }>}
 */
async function provision(claimToken, hardwareId) {
  const device = await devicesModel.findByClaimToken(claimToken);
  if (!device) throw new NotFoundError('claim_token not found');

  if (device.status === 'active') {
    // Idempotent re-provisioning: device already provisioned, return existing token.
    // This handles the case where the ESP32 lost its NVS (reflash) but the backend
    // already completed provisioning. hardware_id must still match if set.
    if (device.hardware_id && device.hardware_id !== hardwareId) {
      throw new UnprocessableEntityError('hardware_id_mismatch');
    }
    logger.info(`[provisioning.service] Device ${device.id} re-provisioning (already active) — returning existing token`);
    return {
      device_token: device.device_token,
      mqtt_url: getMqttUrl(),
      tenant_id: device.tenant_id,
      device_id: device.id,
    };
  }

  if (device.status !== 'claimed') {
    throw new ConflictError('device_already_provisioned');
  }

  if (device.hardware_id && device.hardware_id !== hardwareId) {
    throw new UnprocessableEntityError('hardware_id_mismatch');
  }

  const deviceToken = uuidv4();

  await devicesModel.update(device.id, {
    status: 'active',
    claim_token: null,
    device_token: deviceToken,
    hardware_id: hardwareId,
  });

  logger.info(`[provisioning.service] Device ${device.id} provisioned for tenant ${device.tenant_id}`);

  return {
    device_token: deviceToken,
    mqtt_url: MQTT_URL,
    tenant_id: device.tenant_id,
    device_id: device.id,
  };
}

module.exports = { provision };
