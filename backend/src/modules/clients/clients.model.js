'use strict';

const db = require('../../shared/db/knex');
const { withTenant } = require('../../shared/db/tenant-knex');

/**
 * Data access layer for clients.
 * Tenant-scoped queries use withTenant() for RLS enforcement.
 *
 * TODO: The `clients` table does not yet exist in the database.
 * Migration required before this module is functional:
 *
 * CREATE TABLE clients (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 *   name VARCHAR(255) NOT NULL,
 *   email VARCHAR(255),
 *   phone VARCHAR(50),
 *   address TEXT,
 *   metadata JSONB DEFAULT '{}',
 *   created_at TIMESTAMPTZ DEFAULT now(),
 *   updated_at TIMESTAMPTZ DEFAULT now()
 * );
 * CREATE INDEX idx_clients_tenant_id ON clients(tenant_id);
 *
 * Once the migration is created and run, remove this TODO block.
 */

async function findAll(tenantId) {
  return withTenant(tenantId, (trx) =>
    trx('clients').where({ tenant_id: tenantId }).orderBy('created_at', 'desc')
  );
}

async function findById(tenantId, id) {
  return withTenant(tenantId, (trx) =>
    trx('clients').where({ tenant_id: tenantId, id }).first()
  );
}

async function insert(data) {
  return withTenant(data.tenant_id, (trx) =>
    trx('clients').insert(data).returning('*').then(([row]) => row)
  );
}

async function update(id, data) {
  const [client] = await db('clients')
    .where({ id })
    .update({ ...data, updated_at: db.fn.now() })
    .returning('*');
  return client;
}

async function remove(id) {
  return db('clients').where({ id }).delete();
}

module.exports = { findAll, findById, insert, update, remove };
