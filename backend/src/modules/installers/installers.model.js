'use strict';

const db = require('../../shared/db/knex');

/**
 * Data access layer for installers.
 * Installers ARE tenants — this module manages tenant profile data in the `tenants` table.
 */

async function findAll(pagination = {}) {
  const { page = 1, limit = 20, sortBy = null, sortDir = 'asc' } = pagination;
  const offset = (page - 1) * limit;
  const orderCol = sortBy || 'created_at';
  const orderDir = sortBy ? sortDir : 'desc';

  return db('tenants').orderBy(orderCol, orderDir).limit(limit).offset(offset);
}

async function count() {
  const rows = await db('tenants').count('id');
  return parseInt(rows[0].count, 10);
}

async function findById(id) {
  return db('tenants').where({ id }).first();
}

async function update(id, data) {
  const [installer] = await db('tenants')
    .where({ id })
    .update({ ...data, updated_at: db.fn.now() })
    .returning('*');
  return installer;
}

module.exports = { findAll, findById, update, count };
