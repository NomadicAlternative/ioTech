'use strict';

const db = require('../../shared/db/knex');
const { withTenant } = require('../../shared/db/tenant-knex');

/**
 * Data access layer for devices.
 * All queries are tenant-scoped via withTenant() for RLS enforcement.
 */

/**
 * Retrieve all devices for a tenant, with optional pagination.
 * @param {string} tenantId
 * @param {{ page?: number, limit?: number, sortBy?: string|null, sortDir?: string }} [pagination]
 * @returns {Promise<object[]>}
 */
async function findAll(tenantId, pagination = {}) {
  const { page = 1, limit = 20, sortBy = null, sortDir = 'asc' } = pagination;
  const offset = (page - 1) * limit;
  const orderCol = sortBy || 'created_at';
  const orderDir = sortBy ? sortDir : 'desc';

  return withTenant(tenantId, (trx) =>
    trx('devices')
      .where({ tenant_id: tenantId })
      .orderBy(orderCol, orderDir)
      .limit(limit)
      .offset(offset)
  );
}

/**
 * Count all devices for a tenant.
 * @param {string} tenantId
 * @returns {Promise<number>}
 */
async function count(tenantId) {
  const rows = await withTenant(tenantId, (trx) =>
    trx('devices').where({ tenant_id: tenantId }).count('id')
  );
  return parseInt(rows[0].count, 10);
}

/**
 * Find a single device by ID, scoped to a tenant.
 * @param {string} tenantId
 * @param {string} id
 * @returns {Promise<object|undefined>}
 */
async function findById(tenantId, id) {
  return withTenant(tenantId, (trx) =>
    trx('devices').where({ tenant_id: tenantId, id }).first()
  );
}

/**
 * Find a device by its device_token (for MQTT / device auth).
 * Not tenant-scoped — device identifies itself before tenant is known.
 * @param {string} deviceToken
 * @returns {Promise<object|undefined>}
 */
async function findByToken(deviceToken) {
  return db('devices').where({ device_token: deviceToken }).first();
}

/**
 * Insert a new device record.
 * @param {object} data  — must include tenant_id, name, device_token, etc.
 * @returns {Promise<object>}
 */
async function insert(data) {
  return withTenant(data.tenant_id, (trx) =>
    trx('devices').insert(data).returning('*').then(([row]) => row)
  );
}

/**
 * Update a device by ID (no tenant check here — service is responsible).
 * @param {string} id
 * @param {object} data  — fields to update
 * @returns {Promise<object>}
 */
async function update(id, data) {
  const [device] = await db('devices')
    .where({ id })
    .update({ ...data, updated_at: db.fn.now() })
    .returning('*');
  return device;
}

/**
 * Delete a device by ID.
 * @param {string} id
 * @returns {Promise<number>} rows deleted
 */
async function remove(id) {
  return db('devices').where({ id }).delete();
}

module.exports = { findAll, findById, findByToken, insert, update, remove, count };
