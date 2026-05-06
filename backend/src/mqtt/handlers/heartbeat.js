'use strict';

const devicesModel = require('../../modules/devices/devices.model');
const rulesModel = require('../../modules/rules/rules.model');
const rulesEngine = require('../../modules/rules/rulesEngine');
const devicesService = require('../../modules/devices/devices.service');
const logger = require('../../shared/logger');
const { getSocketService } = require('../../socket/socketServer');

/** Timeout in ms before a device is marked offline. */
const OFFLINE_TIMEOUT_MS = 90_000;

/**
 * Map of deviceId → NodeJS.Timeout.
 * Exported for testing only — do not mutate externally.
 */
const _timers = new Map();

/**
 * Fetch status rules for the tenant and evaluate them against the device status.
 * For matching rules, execute the action and update last_fired_at.
 *
 * This is fire-and-forget — errors are caught internally.
 *
 * @param {string} tenantId
 * @param {string} deviceId
 * @param {string} status
 * @returns {Promise<void>}
 */
async function _evaluateStatusRules(tenantId, deviceId, status) {
  let rules;
  try {
    rules = await rulesModel.findAllByTriggerType(tenantId, 'status');
  } catch (err) {
    logger.error(`[heartbeat] Failed to fetch status rules for device ${deviceId}: ${err.message}`, err);
    return;
  }

  if (!rules || rules.length === 0) return;

  const matches = rulesEngine.evaluateStatusRules(tenantId, deviceId, status, rules);
  if (!matches || matches.length === 0) return;

  for (const match of matches) {
    try {
      const actionPayload = await rulesEngine.executeAction(match.rule, tenantId);
      await devicesService.sendCommand(tenantId, deviceId, actionPayload);
      await rulesModel.updateLastFired(match.rule.id, new Date());
      logger.info(
        `[heartbeat] Rule fired: ${match.rule.name} (${match.rule.id}) for device ${deviceId}`,
        { matchedStatus: match.matchedStatus }
      );
    } catch (err) {
      logger.error(`[heartbeat] Rule action failed for ${match.rule.name}: ${err.message}`, err);
    }
  }
}

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

    const socketSvc = getSocketService();
    if (socketSvc) {
      socketSvc.emitDeviceStatus(tenantId, deviceId, 'online');
    }
  } catch (err) {
    logger.error(`[heartbeat] Failed to update device ${deviceId}: ${err.message}`);
  }

  // Reset the offline timer for this device
  _resetOfflineTimer(tenantId, deviceId);

  // ── Fire-and-forget: evaluate status automation rules ────────────────────
  _evaluateStatusRules(tenantId, deviceId, 'online').catch((err) => {
    logger.error(`[heartbeat] Status rules evaluation error for device ${deviceId}: ${err.message}`, err);
  });
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
