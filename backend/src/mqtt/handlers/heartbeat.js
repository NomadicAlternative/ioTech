'use strict';

const devicesModel = require('../../modules/devices/devices.model');
const logger = require('../../shared/logger');

/**
 * Handle a device heartbeat message.
 * Updates devices.last_seen to the current timestamp.
 *
 * Topic: org/{tenantId}/device/{deviceId}/status
 * Payload: { status: 'online', ...extras }
 *
 * @param {string} tenantId
 * @param {string} deviceId
 * @param {object|null} payload  — parsed JSON payload; null on parse failure
 */
async function handleHeartbeat(tenantId, deviceId, payload) {
  if (!deviceId || !payload) {
    logger.warn(`[heartbeat] Skipping — missing deviceId or null payload (deviceId=${deviceId})`);
    return;
  }

  try {
    await devicesModel.update(deviceId, { last_seen: new Date() });
    logger.info(`[heartbeat] last_seen updated for device ${deviceId} (tenant ${tenantId})`);
  } catch (err) {
    logger.error(`[heartbeat] Failed to update last_seen for device ${deviceId}: ${err.message}`);
  }
}

module.exports = { handleHeartbeat };
