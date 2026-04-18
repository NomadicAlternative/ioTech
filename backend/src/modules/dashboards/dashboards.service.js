'use strict';

const { v4: uuidv4 } = require('uuid');
const dashboardsModel = require('./dashboards.model');
const { NotFoundError, ConflictError, ValidationError } = require('../../shared/errors');
const logger = require('../../shared/logger');

/**
 * Business logic for the dashboards module.
 * All operations are tenant-scoped.
 */

/**
 * Validate that a layout object has the required structure.
 * Throws ValidationError on invalid structure.
 * @param {object} layout
 */
function validateLayoutStructure(layout) {
  if (!layout || typeof layout !== 'object') {
    throw new ValidationError('Layout must be an object');
  }
  if (!Array.isArray(layout.widgets)) {
    throw new ValidationError('Layout must contain a widgets array');
  }
  if (typeof layout.gridConfig !== 'object' || layout.gridConfig === null) {
    throw new ValidationError('Layout must contain a gridConfig object');
  }
}

/**
 * List all dashboards for a tenant (paginated).
 * @param {string} tenantId
 * @param {{ page: number, limit: number, sortBy: string|null, sortDir: string }} [pagination]
 * @returns {Promise<{ data: object[], total: number }>}
 */
async function list(tenantId, pagination = {}) {
  const [data, total] = await Promise.all([
    dashboardsModel.findAll(tenantId, pagination),
    dashboardsModel.count(tenantId),
  ]);
  return { data, total };
}

/**
 * Get a single dashboard by ID, ensuring it belongs to the requesting tenant.
 * @param {string} tenantId
 * @param {string} id
 * @returns {Promise<object>}
 */
async function getById(tenantId, id) {
  const dashboard = await dashboardsModel.findById(tenantId, id);
  if (!dashboard) throw new NotFoundError(`Dashboard not found: ${id}`);
  return dashboard;
}

/**
 * Create a new dashboard.
 * @param {string} tenantId
 * @param {{ name: string, description?: string, layout?: object }} data
 * @returns {Promise<object>}
 */
async function create(tenantId, data) {
  // Use undefined-check so that explicit null is NOT silently replaced with the default.
  // null layout must reach validateLayoutStructure and throw ValidationError.
  const layout = data.layout !== undefined ? data.layout : { widgets: [], gridConfig: {} };
  validateLayoutStructure(layout);

  const dashboard = await dashboardsModel.create(tenantId, {
    id: uuidv4(),
    name: data.name,
    description: data.description || null,
    layout: JSON.stringify(layout),
    installer_id: tenantId,
    created_at: new Date(),
    updated_at: new Date(),
  });

  logger.info(`[dashboards.service] Created dashboard ${dashboard.id} for tenant ${tenantId}`);
  return dashboard;
}

/**
 * Update name/description of an existing dashboard.
 * @param {string} tenantId
 * @param {string} id
 * @param {{ name?: string, description?: string }} data
 * @returns {Promise<object>}
 */
async function update(tenantId, id, data) {
  await getById(tenantId, id); // ownership check

  const updated = await dashboardsModel.update(tenantId, id, {
    name: data.name,
    description: data.description,
  });
  if (!updated) throw new NotFoundError(`Dashboard not found after update: ${id}`);

  logger.info(`[dashboards.service] Updated dashboard ${id} for tenant ${tenantId}`);
  return updated;
}

/**
 * Delete a dashboard.
 * @param {string} tenantId
 * @param {string} id
 * @returns {Promise<void>}
 */
async function remove(tenantId, id) {
  await getById(tenantId, id); // ownership check
  await dashboardsModel.remove(tenantId, id);
  logger.info(`[dashboards.service] Deleted dashboard ${id} for tenant ${tenantId}`);
}

/**
 * Replace the layout of a dashboard (full replace, not patch).
 * @param {string} tenantId
 * @param {string} id
 * @param {object} layout
 * @returns {Promise<object>}
 */
async function updateLayout(tenantId, id, layout) {
  validateLayoutStructure(layout);
  await getById(tenantId, id); // ownership check

  const updated = await dashboardsModel.updateLayout(tenantId, id, layout);
  if (!updated) throw new NotFoundError(`Dashboard not found after layout update: ${id}`);

  logger.info(`[dashboards.service] Updated layout for dashboard ${id}, tenant ${tenantId}`);
  return updated;
}

/**
 * Share a dashboard with a client.
 * @param {string} tenantId
 * @param {string} dashboardId
 * @param {string} clientId
 * @returns {Promise<object>}
 */
async function shareWithClient(tenantId, dashboardId, clientId) {
  await getById(tenantId, dashboardId); // ownership check

  try {
    const record = await dashboardsModel.addClient(tenantId, dashboardId, clientId);
    logger.info(
      `[dashboards.service] Shared dashboard ${dashboardId} with client ${clientId}, tenant ${tenantId}`
    );
    return record;
  } catch (err) {
    // Unique constraint violation — already shared
    if (err.code === '23505') {
      throw new ConflictError('Dashboard is already shared with this client');
    }
    throw err;
  }
}

/**
 * Revoke a dashboard share from a client.
 * @param {string} tenantId
 * @param {string} dashboardId
 * @param {string} clientId
 * @returns {Promise<void>}
 */
async function revokeClientShare(tenantId, dashboardId, clientId) {
  await getById(tenantId, dashboardId); // ownership check

  const deleted = await dashboardsModel.removeClient(tenantId, dashboardId, clientId);
  if (!deleted) throw new NotFoundError(`Share not found for client ${clientId}`);

  logger.info(
    `[dashboards.service] Revoked dashboard ${dashboardId} share from client ${clientId}, tenant ${tenantId}`
  );
}

/**
 * List all clients a dashboard is shared with.
 * @param {string} tenantId
 * @param {string} dashboardId
 * @returns {Promise<object[]>}
 */
async function listSharedClients(tenantId, dashboardId) {
  await getById(tenantId, dashboardId); // ownership check
  return dashboardsModel.findClientsByDashboard(tenantId, dashboardId);
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  updateLayout,
  shareWithClient,
  revokeClientShare,
  listSharedClients,
};
