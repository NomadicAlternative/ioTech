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
  return { data: rawData.map(omitSchema), total };
}

async function getById(tenantId, id) {
  const template = await templatesModel.findById(tenantId, id);
  if (!template) throw new NotFoundError(`Device template not found: ${id}`);
  return omitSchema(template);
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
    datastreams,
    created_at: new Date(),
    updated_at: new Date(),
  });

  logger.info(`[device-templates.service] Created template ${template.id} for tenant ${tenantId}`);
  return omitSchema(template);
}

async function update(tenantId, id, data) {
  await getById(tenantId, id); // ensures tenant ownership

  if (data.datastreams !== undefined) {
    validateDatastreams(data.datastreams);
  }

  const { tenant_id: _tenantId, created_at: _createdAt, ...safeData } = data;
  const updated = await templatesModel.update(id, safeData);
  if (!updated) throw new NotFoundError(`Template not found after update: ${id}`);

  logger.info(`[device-templates.service] Updated template ${id} for tenant ${tenantId}`);
  return omitSchema(updated);
}

async function remove(tenantId, id) {
  await getById(tenantId, id);
  await templatesModel.remove(id);
  logger.info(`[device-templates.service] Deleted template ${id} for tenant ${tenantId}`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Strips the deprecated `schema` field from a template row.
 * Returns all other fields including `datastreams`.
 * @param {object} template
 * @returns {object}
 */
function omitSchema(template) {
  if (!template) return template;
  const { schema: _schema, ...rest } = template;
  return rest;
}

module.exports = { list, getById, create, update, remove, validateDatastreams };
