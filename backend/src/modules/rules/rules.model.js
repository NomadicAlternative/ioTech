'use strict';

const db = require('../../shared/db/knex');
const { withTenant } = require('../../shared/db/tenant-knex');

/**
 * Data access layer for automation rules.
 * All queries are tenant-scoped via withTenant() for RLS enforcement.
 */

/**
 * Strip tenant_id from a row before returning it to the service layer.
 * Consistent with other models (tenant_id must not leak to API responses).
 * @param {object} row
 * @returns {object}
 */
function stripTenantId(row) {
  if (!row) return row;
  const { tenant_id, ...rest } = row;
  return rest;
}

/**
 * Retrieve all rules for a tenant, with optional pagination.
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
    trx('rules')
      .where({ tenant_id: tenantId })
      .orderBy(orderCol, orderDir)
      .limit(limit)
      .offset(offset)
  ).then((rows) => rows.map(stripTenantId));
}

/**
 * Find a single rule by ID, scoped to a tenant.
 * @param {string} tenantId
 * @param {string} id
 * @returns {Promise<object|undefined>}
 */
async function findById(tenantId, id) {
  return withTenant(tenantId, (trx) =>
    trx('rules').where({ tenant_id: tenantId, id }).first()
  ).then((row) => stripTenantId(row));
}

/**
 * Insert a new rule record.
 * @param {object} data — must include tenant_id, name, trigger_type, etc.
 * @returns {Promise<object>}
 */
async function insert(data) {
  return withTenant(data.tenant_id, (trx) =>
    trx('rules').insert(data).returning('*').then(([row]) => row)
  ).then(stripTenantId);
}

/**
 * Update a rule by ID.
 * @param {string} id
 * @param {object} data — fields to update
 * @returns {Promise<object>}
 */
async function update(id, data) {
  return withTenant(null, (trx) =>
    trx('rules')
      .where({ id })
      .update({ ...data, updated_at: db.fn.now() })
      .returning('*')
      .then(([row]) => row)
  ).then(stripTenantId);
}

/**
 * Delete a rule by ID.
 * @param {string} id
 * @returns {Promise<number>} rows deleted
 */
async function remove(id) {
  return db('rules').where({ id }).delete();
}

/**
 * Update only the last_fired_at timestamp for a rule.
 * Used by the rules engine to track cooldown state.
 * @param {string} id
 * @param {Date|string} timestamp
 * @returns {Promise<object>}
 */
async function updateLastFired(id, timestamp) {
  return withTenant(null, (trx) =>
    trx('rules')
      .where({ id })
      .update({ last_fired_at: timestamp, updated_at: db.fn.now() })
      .returning('*')
      .then(([row]) => row)
  ).then(stripTenantId);
}

/**
 * Find all rules for a tenant filtered by trigger type.
 * Used by hooks (telemetry, heartbeat) to fetch relevant rules for evaluation.
 * @param {string} tenantId
 * @param {string} triggerType — 'threshold' | 'device_status'
 * @returns {Promise<object[]>}
 */
async function findAllByTriggerType(tenantId, triggerType) {
  return withTenant(tenantId, (trx) =>
    trx('rules')
      .where({ tenant_id: tenantId, trigger_type: triggerType })
      .orderBy('created_at', 'desc')
  ).then((rows) => rows.map(stripTenantId));
}

module.exports = { findAll, findById, findAllByTriggerType, insert, update, remove, updateLastFired };
