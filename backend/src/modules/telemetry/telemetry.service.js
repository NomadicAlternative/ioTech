'use strict';

const db = require('../../shared/db/knex');
const telemetryModel = require('./telemetry.model');
const rulesModel = require('../rules/rules.model');
const rulesEngine = require('../rules/rulesEngine');
const devicesService = require('../devices/devices.service');
const { NotFoundError, ValidationError } = require('../../shared/errors');
const logger = require('../../shared/logger');

/**
 * Business logic for the telemetry module.
 *
 * The `ingest()` method is the MQTT bridge entry point.
 * It is called from mqttClient.js and handles persistence + device validation.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

// JavaScript type names as returned by typeof
const JS_TYPE_MAP = {
  number: 'number',
  string: 'string',
  boolean: 'boolean',
  json: 'object', // json datastreams accept any object/array
};

// ─── validatePayloadAgainstDatastreams() ─────────────────────────────────────

/**
 * Validates a telemetry payload against a template's datastreams definition.
 *
 * Rules:
 * 1. Unknown keys → ignored silently (do not drop message)
 * 2. Output direction → ignored (treated as unknown — not validated on ingestion)
 * 3. Type mismatch → drop payload (return error info) + log warning
 *
 * @param {object} payload       — flat key-value telemetry object
 * @param {Array}  datastreams   — template datastreams definition
 * @param {string} deviceId      — for logging context
 * @returns {{ valid: boolean, key?: string, reason?: string }}
 */
function validatePayloadAgainstDatastreams(payload, datastreams, _deviceId) {
  // Build a lookup map of ingestible datastreams (input + config only)
  const ingestibleMap = {};
  for (const ds of datastreams) {
    if (ds.direction === 'output') continue; // ignore output — not validated on ingestion
    ingestibleMap[ds.key] = ds;
  }

  for (const [key, value] of Object.entries(payload)) {
    const ds = ingestibleMap[key];
    if (!ds) continue; // unknown key → silently ignore

    const expectedJsType = JS_TYPE_MAP[ds.type];
    const actualType = typeof value;

    // json type accepts any non-null object/array
    if (ds.type === 'json') {
      if (value === null || typeof value !== 'object') {
        return { valid: false, key, reason: 'telemetry.type_mismatch' };
      }
    } else if (actualType !== expectedJsType) {
      return { valid: false, key, reason: 'telemetry.type_mismatch' };
    }
  }

  return { valid: true };
}

// ─── _evaluateThresholdRules() (fire-and-forget helper) ───────────────────────

/**
 * Fetch threshold rules for the tenant and evaluate them against telemetry data.
 * For matching rules, execute the action and update last_fired_at.
 *
 * This is fire-and-forget — errors are caught internally.
 *
 * @param {string} tenantId
 * @param {string} deviceId
 * @param {object} telemetryData
 * @returns {Promise<void>}
 */
async function _evaluateThresholdRules(tenantId, deviceId, telemetryData) {
  let rules;
  try {
    rules = await rulesModel.findAllByTriggerType(tenantId, 'threshold');
  } catch (err) {
    logger.error(`[telemetry.service] Failed to fetch rules for device ${deviceId}: ${err.message}`, err);
    return;
  }

  if (!rules || rules.length === 0) return;

  const matches = rulesEngine.evaluateThresholdRules(tenantId, deviceId, telemetryData, rules);
  if (!matches || matches.length === 0) return;

  for (const match of matches) {
    try {
      const actionPayload = await rulesEngine.executeAction(match.rule, tenantId);
      await devicesService.sendCommand(tenantId, deviceId, actionPayload);
      await rulesModel.updateLastFired(match.rule.id, new Date());
      logger.info(
        `[telemetry.service] Rule fired: ${match.rule.name} (${match.rule.id}) for device ${deviceId}`,
        { matchedField: match.matchedField, matchedValue: match.matchedValue }
      );
    } catch (err) {
      logger.error(`[telemetry.service] Rule action failed for ${match.rule.name}: ${err.message}`, err);
    }
  }
}

// ─── ingest() ────────────────────────────────────────────────────────────────

/**
 * Ingest a telemetry payload (called by MQTT bridge).
 * Validates the device exists and is active before persisting.
 * If the device has a template_id, validates the payload against datastreams.
 *
 * @param {string} tenantId   — from device record (resolved via deviceId lookup)
 * @param {string} deviceId   — from MQTT topic (devices/<deviceId>/telemetry)
 * @param {object} data       — parsed JSON payload from MQTT message
 * @param {Date}   [receivedAt] — timestamp (defaults to now)
 * @returns {Promise<object|null>} inserted telemetry row, or null on silent drop
 */
async function ingest(tenantId, deviceId, data, receivedAt) {
  if (!deviceId) throw new ValidationError('deviceId is required for telemetry ingestion');

  // Verify device exists and is active (avoids persisting data for ghost devices)
  const device = await db('devices').where({ id: deviceId, status: 'active' }).first();

  if (!device) {
    logger.warn(`[telemetry.service] Ignoring telemetry for unknown/inactive device: ${deviceId}`);
    return null; // silent drop — don't throw, MQTT bridge must not crash
  }

  // ── Datastream validation ──────────────────────────────────────────────────
  if (device.template_id) {
    const template = await db('device_templates').where({ id: device.template_id }).first();

    if (template) {
      const datastreams = template.datastreams || [];

      if (datastreams.length === 0) {
        // Legacy template: no datastreams defined — skip validation, log warning
        logger.warn(
          `[telemetry.service] Template has no datastreams — unvalidated ingestion`,
          { device_id: deviceId, template_id: device.template_id }
        );
      } else {
        const result = validatePayloadAgainstDatastreams(data || {}, datastreams, deviceId);
        if (!result.valid) {
          logger.warn(
            `[telemetry.service] ${result.reason} — dropping telemetry payload`,
            { device_id: deviceId, key: result.key, reason: result.reason }
          );
          return null; // silent drop
        }
      }
    }
  }
  // ── End datastream validation ──────────────────────────────────────────────

  // Update device.last_seen
  await db('devices').where({ id: deviceId }).update({ last_seen: new Date(), updated_at: new Date() });

  const row = await telemetryModel.insert({
    deviceId,
    tenantId: tenantId || device.tenant_id, // fall back to device's own tenant_id
    data: data || {},
    receivedAt: receivedAt || new Date(),
  });

  logger.debug(`[telemetry.service] Ingested telemetry for device ${deviceId}`, { rowId: row.id });

  // ── Fire-and-forget: evaluate automation rules ────────────────────────────
  _evaluateThresholdRules(tenantId || device.tenant_id, deviceId, data).catch((err) => {
    logger.error(`[telemetry.service] Rules evaluation error for device ${deviceId}: ${err.message}`, err);
  });

  return row;
}

/**
 * Query telemetry for a specific device within a tenant.
 *
 * @param {string} tenantId
 * @param {string} deviceId
 * @param {{ from?: string, to?: string, limit?: number, page?: number, sortDir?: string }} opts
 * @returns {Promise<{ data: object[], total: number }>}
 */
async function query(tenantId, deviceId, opts = {}) {
  if (!deviceId) throw new ValidationError('deviceId is required');

  // Ensure device belongs to this tenant
  const device = await db('devices').where({ id: deviceId, tenant_id: tenantId }).first();
  if (!device) throw new NotFoundError(`Device not found: ${deviceId}`);

  const [data, total] = await Promise.all([
    telemetryModel.findByDevice(tenantId, deviceId, opts),
    telemetryModel.count(tenantId, deviceId, { from: opts.from, to: opts.to }),
  ]);

  return { data, total };
}

module.exports = { ingest, query, validatePayloadAgainstDatastreams };
