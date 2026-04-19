'use strict';

const { withTenant } = require('../../shared/db/tenant-knex');

/**
 * Data access layer for dashboards.
 * All queries are tenant-scoped via withTenant() for RLS enforcement.
 * RLS uses installer_id = app.tenant_id setting.
 */

/**
 * Insert a new dashboard.
 * @param {string} tenantId
 * @param {object} data
 * @returns {Promise<object>}
 */
async function create(tenantId, data) {
  return withTenant(tenantId, (trx) =>
    trx('dashboards').insert(data).returning('*').then(([row]) => row)
  );
}

/**
 * Retrieve all dashboards for a tenant (paginated).
 * @param {string} tenantId
 * @param {{ page?: number, limit?: number, sortBy?: string|null, sortDir?: string }} [pagination]
 * @returns {Promise<object[]>}
 */
async function findAll(tenantId, ownerId, pagination = {}) {
  const { page = 1, limit = 20, sortBy = null, sortDir = 'asc' } = pagination;
  const offset = (page - 1) * limit;
  const orderCol = sortBy || 'created_at';
  const orderDir = sortBy ? sortDir : 'desc';

  return withTenant(tenantId, (trx) =>
    trx('dashboards')
      .where({ installer_id: ownerId })
      .orderBy(orderCol, orderDir)
      .limit(limit)
      .offset(offset)
  );
}

/**
 * Count all dashboards for an owner.
 * @param {string} tenantId
 * @param {string} ownerId — the user ID that owns the dashboards
 * @returns {Promise<number>}
 */
async function count(tenantId, ownerId) {
  const rows = await withTenant(tenantId, (trx) =>
    trx('dashboards').where({ installer_id: ownerId }).count('id')
  );
  return parseInt(rows[0].count, 10);
}

/**
 * Find a single dashboard by ID, scoped to an owner.
 * @param {string} tenantId
 * @param {string} ownerId
 * @param {string} id
 * @returns {Promise<object|undefined>}
 */
async function findById(tenantId, ownerId, id) {
  return withTenant(tenantId, (trx) =>
    trx('dashboards').where({ installer_id: ownerId, id }).first()
  );
}

/**
 * Update a dashboard by ID.
 * @param {string} tenantId
 * @param {string} id
 * @param {object} data
 * @returns {Promise<object>}
 */
async function update(tenantId, ownerId, id, data) {
  return withTenant(tenantId, (trx) =>
    trx('dashboards')
      .where({ installer_id: ownerId, id })
      .update({ ...data, updated_at: trx.fn.now() })
      .returning('*')
      .then(([row]) => row)
  );
}

/**
 * Delete a dashboard by ID.
 * @param {string} tenantId
 * @param {string} id
 * @returns {Promise<number>} rows deleted
 */
async function remove(tenantId, ownerId, id) {
  return withTenant(tenantId, (trx) =>
    trx('dashboards').where({ installer_id: ownerId, id }).delete()
  );
}

/**
 * Update only the layout JSONB column.
 * @param {string} tenantId
 * @param {string} id
 * @param {object} layout
 * @returns {Promise<object>}
 */
async function updateLayout(tenantId, ownerId, id, layout) {
  return withTenant(tenantId, (trx) =>
    trx('dashboards')
      .where({ installer_id: ownerId, id })
      .update({ layout: JSON.stringify(layout), updated_at: trx.fn.now() })
      .returning('*')
      .then(([row]) => row)
  );
}

/**
 * Add a client to a dashboard (share).
 * @param {string} tenantId
 * @param {string} dashboardId
 * @param {string} clientId
 * @returns {Promise<object>}
 */
async function addClient(tenantId, dashboardId, clientId) {
  return withTenant(tenantId, (trx) =>
    trx('dashboard_clients')
      .insert({ dashboard_id: dashboardId, client_id: clientId })
      .returning('*')
      .then(([row]) => row)
  );
}

/**
 * Remove a client from a dashboard (revoke share).
 * @param {string} tenantId
 * @param {string} dashboardId
 * @param {string} clientId
 * @returns {Promise<number>} rows deleted
 */
async function removeClient(tenantId, dashboardId, clientId) {
  return withTenant(tenantId, (trx) =>
    trx('dashboard_clients')
      .where({ dashboard_id: dashboardId, client_id: clientId })
      .delete()
  );
}

/**
 * List all clients a dashboard is shared with.
 * @param {string} tenantId
 * @param {string} dashboardId
 * @returns {Promise<object[]>}
 */
async function findClientsByDashboard(tenantId, dashboardId) {
  return withTenant(tenantId, (trx) =>
    trx('dashboard_clients')
      .join('clients', 'clients.id', 'dashboard_clients.client_id')
      .where({ 'dashboard_clients.dashboard_id': dashboardId })
      .select('clients.*', 'dashboard_clients.created_at as shared_at')
  );
}

module.exports = {
  create,
  findAll,
  count,
  findById,
  update,
  remove,
  updateLayout,
  addClient,
  removeClient,
  findClientsByDashboard,
};
