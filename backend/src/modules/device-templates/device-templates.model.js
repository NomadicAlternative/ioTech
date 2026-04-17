'use strict';

const db = require('../../shared/db/knex');
const { withTenant } = require('../../shared/db/tenant-knex');

/**
 * Data access layer for device templates.
 * Tenant-scoped queries use withTenant() for RLS enforcement.
 */

async function findAll(tenantId, pagination = {}) {
  const { page = 1, limit = 20, sortBy = null, sortDir = 'asc' } = pagination;
  const offset = (page - 1) * limit;
  const orderCol = sortBy || 'created_at';
  const orderDir = sortBy ? sortDir : 'desc';

  return withTenant(tenantId, (trx) =>
    trx('device_templates')
      .where({ tenant_id: tenantId })
      .orderBy(orderCol, orderDir)
      .limit(limit)
      .offset(offset)
  );
}

async function count(tenantId) {
  const rows = await withTenant(tenantId, (trx) =>
    trx('device_templates').where({ tenant_id: tenantId }).count('id')
  );
  return parseInt(rows[0].count, 10);
}

async function findById(tenantId, id) {
  return withTenant(tenantId, (trx) =>
    trx('device_templates').where({ tenant_id: tenantId, id }).first()
  );
}

async function insert(data) {
  return withTenant(data.tenant_id, (trx) =>
    trx('device_templates').insert(data).returning('*').then(([row]) => row)
  );
}

async function update(id, data) {
  const [template] = await db('device_templates')
    .where({ id })
    .update({ ...data, updated_at: db.fn.now() })
    .returning('*');
  return template;
}

async function remove(id) {
  return db('device_templates').where({ id }).delete();
}

module.exports = { findAll, findById, insert, update, remove, count };
