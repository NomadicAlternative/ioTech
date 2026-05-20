'use strict';

const { v4: uuidv4 } = require('uuid');
const templatesModel = require('./device-templates.model');
const { NotFoundError, UnprocessableEntityError } = require('../../shared/errors');
const logger = require('../../shared/logger');

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_TYPES = ['number', 'string', 'boolean', 'json'];
const VALID_DIRECTIONS = ['input', 'output', 'config'];

// ─── validateDatastreams() ────────────────────────────────────────────────────

/**
 * Validates an array of datastream definitions.
 * Throws ValidationError with machine-readable codes on failure.
 *
 * @param {Array} datastreams — array of datastream objects to validate
 * @throws {ValidationError} datastreams.field.required | datastreams.type.invalid |
 *                           datastreams.direction.invalid | datastreams.key.duplicate
 */
function validateDatastreams(datastreams) {
  if (!Array.isArray(datastreams)) {
    throw new UnprocessableEntityError('datastreams must be an array');
  }

  const seenKeys = new Set();

  for (const ds of datastreams) {
    // Required field checks
    if (!ds.key || !ds.name || !ds.type || !ds.direction) {
      throw new UnprocessableEntityError('datastreams.field.required');
    }

    // Type enum check
    if (!VALID_TYPES.includes(ds.type)) {
      throw new UnprocessableEntityError('datastreams.type.invalid');
    }

    // Direction enum check
    if (!VALID_DIRECTIONS.includes(ds.direction)) {
      throw new UnprocessableEntityError('datastreams.direction.invalid');
    }

    // Duplicate key check
    if (seenKeys.has(ds.key)) {
      throw new UnprocessableEntityError('datastreams.key.duplicate');
    }
    seenKeys.add(ds.key);
  }
}

// ─── Service functions ────────────────────────────────────────────────────────

async function list(tenantId, pagination = {}) {
  const [rawData, total] = await Promise.all([
    templatesModel.findAll(tenantId, pagination),
    templatesModel.count(tenantId),
  ]);
  return { data: rawData.map(transformTemplate), total };
}

async function getById(tenantId, id) {
  const template = await templatesModel.findById(tenantId, id);
  if (!template) throw new NotFoundError(`Device template not found: ${id}`);
  return transformTemplate(template);
}

async function create(tenantId, data) {
  const datastreams = data.datastreams || [];
  validateDatastreams(datastreams);

  const template = await templatesModel.insert({
    id: uuidv4(),
    tenant_id: tenantId,
    name: data.name,
    description: data.description || null,
    schema: data.schema || {},
    datastreams: JSON.stringify(datastreams),
    created_at: new Date(),
    updated_at: new Date(),
  });

  logger.info(`[device-templates.service] Created template ${template.id} for tenant ${tenantId}`);
  return transformTemplate(template);
}

async function update(tenantId, id, data) {
  await getById(tenantId, id); // ensures tenant ownership

  if (data.datastreams !== undefined) {
    validateDatastreams(data.datastreams);
  }

  const { tenant_id: _tenantId, created_at: _createdAt, ...safeData } = data;
  if (data.datastreams !== undefined) {
    safeData.datastreams = JSON.stringify(data.datastreams);
  }
  const updated = await templatesModel.update(id, safeData);
  if (!updated) throw new NotFoundError(`Template not found after update: ${id}`);

  logger.info(`[device-templates.service] Updated template ${id} for tenant ${tenantId}`);
  return transformTemplate(updated);
}

async function remove(tenantId, id) {
  await getById(tenantId, id);
  await templatesModel.remove(id);
  logger.info(`[device-templates.service] Deleted template ${id} for tenant ${tenantId}`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Capitalizes first letter and replaces underscores with spaces.
 * @param {string} key
 * @returns {string}
 */
function keyToName(key) {
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
}

/**
 * Transforms a template row for API responses:
 * - If `datastreams` is already a non-empty array, just strips `schema` and returns.
 * - Otherwise, derives `datastreams` from `schema` (sensors→input, actuators→output, config→config).
 * - Omits the `schema` field from the returned object.
 *
 * @param {object} template
 * @returns {object}
 */
function transformTemplate(template) {
  if (!template) return template;

  const { schema, datastreams, ...rest } = template;

  // If datastreams already populated, skip transform
  if (Array.isArray(datastreams) && datastreams.length > 0) {
    return { ...rest, datastreams };
  }

  // Build datastreams from schema
  const derived = [];

  if (schema && typeof schema === 'object') {
    for (const sensor of schema.sensors || []) {
      derived.push({
        key: sensor.key,
        name: sensor.name || keyToName(sensor.key),
        type: sensor.type === 'float' ? 'number' : sensor.type,
        direction: 'input',
        unit: sensor.unit || null,
        min: sensor.min !== undefined ? sensor.min : null,
        max: sensor.max !== undefined ? sensor.max : null,
      });
    }

    for (const actuator of schema.actuators || []) {
      derived.push({
        key: actuator.key,
        name: actuator.name || keyToName(actuator.key),
        type: actuator.type === 'float' ? 'number' : actuator.type,
        direction: 'output',
        unit: actuator.unit || null,
        min: actuator.min !== undefined ? actuator.min : null,
        max: actuator.max !== undefined ? actuator.max : null,
      });
    }

    for (const cfg of schema.config || []) {
      derived.push({
        key: cfg.key,
        name: cfg.name || keyToName(cfg.key),
        type: cfg.type === 'integer' ? 'number' : cfg.type,
        direction: 'config',
        default: cfg.default !== undefined ? cfg.default : null,
      });
    }

    // Merge driver fields from schema.drivers into derived datastreams
    // Matches drivers to datastreams by model → sensor type mapping
    if (schema.drivers && Array.isArray(schema.drivers) && schema.drivers.length > 0) {
      for (const drv of schema.drivers) {
        // Map driver model to the datastream keys it typically produces
        const driverModel = (drv.model || '').toUpperCase();
        for (const ds of derived) {
          // Skip datastreams that already have driver_name set
          if (ds.driver_name) continue;

          // Match drivers to datastreams by model name
          if (
            (driverModel.startsWith('DHT') && ['temperature', 'humidity'].includes(ds.key)) ||
            (driverModel.startsWith('BME') &&
              ['temperature', 'humidity', 'pressure'].includes(ds.key)) ||
            (driverModel.startsWith('BMP') && ['temperature', 'pressure'].includes(ds.key)) ||
            (driverModel.startsWith('DS18') && ds.key === 'temperature') ||
            (driverModel === 'PIR' && ds.key === 'motion') ||
            (driverModel === 'HC-SR04' && ds.key === 'distance') ||
            (driverModel === 'BH1750' && ds.key === 'lux') ||
            (driverModel === 'RELAY' && ds.key.startsWith('relay')) ||
            (driverModel === 'WS2812B' && ds.key.startsWith('led')) ||
            (driverModel === 'SERVO' && ds.key.startsWith('servo')) ||
            (driverModel === 'SSD1306' && ds.key.startsWith('display'))
          ) {
            ds.driver_name = drv.model;
            ds.gpio = drv.gpio !== undefined ? drv.gpio : null;
            ds.i2c_addr = drv.i2c_addr !== undefined ? drv.i2c_addr : null;
            ds.config = drv.config !== undefined ? drv.config : null;
          }
        }
      }
    }
  }

  return { ...rest, datastreams: derived };
}

/**
 * Strips the deprecated `schema` field from a template row.
 * @deprecated Use transformTemplate instead.
 * @param {object} template
 * @returns {object}
 */
function omitSchema(template) {
  if (!template) return template;
  const { schema: _schema, ...rest } = template;
  return rest;
}

module.exports = { list, getById, create, update, remove, validateDatastreams };
