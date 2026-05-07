'use strict';

const db = require('../../shared/db/knex');
const { withTenant } = require('../../shared/db/tenant-knex');

/**
 * Data access layer for devices.
 * All queries are tenant-scoped via withTenant() for RLS enforcement.
 */

/**
 * Retrieve all devices for a tenant, optionally filtered by status.
 * Uses withTenant() so PostgreSQL RLS policy (tenant_id = app.tenant_id) is enforced
 * as a second layer of defence alongside the explicit where({ tenant_id }).
 * @param {string} tenantId
 * @param {{ status?: string }} [filters={}]
 * @returns {Promise<object[]>}
 */
async function findAll(tenantId, filters = {}) {
  return withTenant(tenantId, (trx) => {
    let query = trx('devices').where({ tenant_id: tenantId });

    if (filters.status) {
      query = query.andWhere({ status: filters.status });
    }

    return query.orderBy('created_at', 'desc');
  });
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

module.exports = { findAll, findById, findByToken, insert, update, remove };
