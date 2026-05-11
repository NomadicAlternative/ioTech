'use strict';

const db = require('../../shared/db/knex');

/**
 * Find all firmware records for a tenant.
 */
async function findAll(tenantId) {
  return db('firmware_versions').where({ tenant_id: tenantId }).orderBy('created_at', 'desc');
}

/**
 * Find a firmware record by ID scoped to a tenant.
 */
async function findById(tenantId, id) {
  return db('firmware_versions').where({ tenant_id: tenantId, id }).first();
}

/**
 * Find a firmware record by version + hardware_model (for duplicate check).
 * Not tenant-scoped — versions are global across tenants for conflict detection.
 */
async function findByVersionAndModel(version, hardwareModel) {
  return db('firmware_versions').where({ version, hardware_model: hardwareModel }).first();
}

/**
 * Insert a new firmware record.
 */
async function insert(data) {
  const [row] = await db('firmware_versions').insert(data).returning('*');
  return row;
}

/**
 * Update a firmware record by ID.
 */
async function update(id, data) {
  const [row] = await db('firmware_versions')
    .where({ id })
    .update({ ...data, updated_at: db.fn.now() })
    .returning('*');
  return row;
}

/**
 * Delete a firmware record by ID.
 */
async function remove(id) {
  return db('firmware_versions').where({ id }).delete();
}

/**
 * Find the latest firmware version for a given hardware model.
 * Returns the full row or undefined if none exist.
 */
async function findLatestByHardwareModel(hardwareModel) {
  return db('firmware_versions')
    .where({ hardware_model: hardwareModel })
    .orderBy('version', 'desc')
    .first();
}

module.exports = { findAll, findById, findByVersionAndModel, findLatestByHardwareModel, insert, update, remove };
