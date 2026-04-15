'use strict';

const db = require('../../shared/db/knex');

/**
 * Data access layer for installers.
 * Installers ARE tenants — this module manages tenant profile data in the `tenants` table.
 */

async function findAll() {
  return db('tenants').orderBy('created_at', 'desc');
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

module.exports = { findAll, findById, update };
