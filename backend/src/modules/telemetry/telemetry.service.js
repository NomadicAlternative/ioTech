'use strict';

const db = require('../../shared/db/knex');
const telemetryModel = require('./telemetry.model');
const { NotFoundError, ValidationError } = require('../../shared/errors');
const logger = require('../../shared/logger');

/**
 * Business logic for the telemetry module.
 *
 * The `ingest()` method is the MQTT bridge entry point.
 * It is called from mqttClient.js and handles persistence + device validation.
 */

/**
 * Ingest a telemetry payload (called by MQTT bridge).
 * Validates the device exists and is active before persisting.
 *
 * @param {string} tenantId   — from device record (resolved via deviceId lookup)
 * @param {string} deviceId   — from MQTT topic (devices/<deviceId>/telemetry)
 * @param {object} data       — parsed JSON payload from MQTT message
 * @param {Date}   [receivedAt] — timestamp (defaults to now)
 * @returns {Promise<object>} inserted telemetry row
 */
async function ingest(tenantId, deviceId, data, receivedAt) {
  if (!deviceId) throw new ValidationError('deviceId is required for telemetry ingestion');

  // Verify device exists and is active (avoids persisting data for ghost devices)
  const device = await db('devices').where({ id: deviceId, status: 'active' }).first();

  if (!device) {
    logger.warn(`[telemetry.service] Ignoring telemetry for unknown/inactive device: ${deviceId}`);
    return null; // silent drop — don't throw, MQTT bridge must not crash
  }

  // Update device.last_seen
  await db('devices').where({ id: deviceId }).update({ last_seen: new Date(), updated_at: new Date() });

  const row = await telemetryModel.insert({
    deviceId,
    tenantId: tenantId || device.tenant_id, // fall back to device's own tenant_id
    data: data || {},
    receivedAt: receivedAt || new Date(),
  });

  logger.debug(`[telemetry.service] Ingested telemetry for device ${deviceId}`, { rowId: row.id });
  return row;
}

/**
 * Query telemetry for a specific device within a tenant.
 *
 * @param {string} tenantId
 * @param {string} deviceId
 * @param {{ from?: string, to?: string, limit?: number }} opts
 * @returns {Promise<object[]>}
 */
async function query(tenantId, deviceId, opts = {}) {
  if (!deviceId) throw new ValidationError('deviceId is required');

  // Ensure device belongs to this tenant
  const device = await db('devices').where({ id: deviceId, tenant_id: tenantId }).first();
  if (!device) throw new NotFoundError(`Device not found: ${deviceId}`);

  return telemetryModel.findByDevice(tenantId, deviceId, opts);
}

module.exports = { ingest, query };
