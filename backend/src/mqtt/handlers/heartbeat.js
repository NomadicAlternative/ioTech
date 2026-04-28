'use strict';

const devicesModel = require('../../modules/devices/devices.model');
const logger = require('../../shared/logger');
const { getSocketService } = require('../../socket/socketServer');

/** Timeout in ms before a device is marked offline. */
const OFFLINE_TIMEOUT_MS = 60_000;

/**
 * Map of deviceId → NodeJS.Timeout.
 * Exported for testing only — do not mutate externally.
 */
const _timers = new Map();

/**
 * Handle a device heartbeat message.
 * - Updates devices.last_seen and status = 'online'.
 * - Resets a 60-second offline timer; if it fires the device is marked offline
 *   in the DB and a `device:status` WebSocket event is emitted.
 *
 * Topic: org/{tenantId}/device/{deviceId}/status
 * Payload: { status: 'online', ...extras } or plain string 'online'
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
    await devicesModel.update(deviceId, { last_seen: new Date(), status: 'online' });
    logger.info(`[heartbeat] device ${deviceId} online (tenant ${tenantId})`);
  } catch (err) {
    logger.error(`[heartbeat] Failed to update device ${deviceId}: ${err.message}`);
  }

  // Reset the offline timer for this device
  _resetOfflineTimer(tenantId, deviceId);
}

/**
 * Clear any existing timer and start a new one.
 * When it fires, mark the device offline in DB and notify via WebSocket.
 *
 * @param {string} tenantId
 * @param {string} deviceId
 */
function _resetOfflineTimer(tenantId, deviceId) {
  if (_timers.has(deviceId)) {
    clearTimeout(_timers.get(deviceId));
  }

  const timer = setTimeout(async () => {
    _timers.delete(deviceId);
    logger.info(`[heartbeat] device ${deviceId} timed out — marking offline`);

    try {
      await devicesModel.update(deviceId, { status: 'offline' });
    } catch (err) {
      logger.error(`[heartbeat] Failed to mark device ${deviceId} offline: ${err.message}`);
    }

    const socketSvc = getSocketService();
    if (socketSvc) {
      socketSvc.emitDeviceStatus(tenantId, deviceId, 'offline');
    }
  }, OFFLINE_TIMEOUT_MS);

  _timers.set(deviceId, timer);
}

module.exports = { handleHeartbeat, _timers, OFFLINE_TIMEOUT_MS };
