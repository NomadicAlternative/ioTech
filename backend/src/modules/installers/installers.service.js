'use strict';

const installersModel = require('./installers.model');
const { NotFoundError, ForbiddenError } = require('../../shared/errors');
const logger = require('../../shared/logger');

/**
 * Business logic for the installers module.
 * Installers ARE tenants, so this mostly deals with the tenants table.
 */

/**
 * List all installers (admin only — enforced at route level).
 * @param {{ page: number, limit: number, sortBy: string|null, sortDir: string }} [pagination]
 * @returns {Promise<{ data: object[], total: number }>}
 */
async function list(pagination = {}) {
  const [data, total] = await Promise.all([
    installersModel.findAll(pagination),
    installersModel.count(),
  ]);
  return { data, total };
}

/**
 * Get a single installer by ID.
 * An installer can only fetch their own profile; admins can fetch any.
 * @param {string} requestingUserId  — from req.user
 * @param {string} requestingRole    — from req.user
 * @param {string} requestingTenantId — from req.tenantId
 * @param {string} id                — target installer/tenant ID
 * @returns {Promise<object>}
 */
async function getById(requestingRole, requestingTenantId, id) {
  const installer = await installersModel.findById(id);
  if (!installer) throw new NotFoundError(`Installer not found: ${id}`);

  // A non-admin installer can only see their own profile
  if (requestingRole !== 'admin' && requestingTenantId !== id) {
    throw new ForbiddenError('You can only view your own installer profile');
  }

  return installer;
}

/**
 * Update an installer profile.
 * Non-admins can only update their own profile.
 * @param {string} requestingRole
 * @param {string} requestingTenantId
 * @param {string} id
 * @param {object} data
 * @returns {Promise<object>}
 */
async function update(requestingRole, requestingTenantId, id, data) {
  const installer = await installersModel.findById(id);
  if (!installer) throw new NotFoundError(`Installer not found: ${id}`);

  if (requestingRole !== 'admin' && requestingTenantId !== id) {
    throw new ForbiddenError('You can only update your own installer profile');
  }

  // Strip fields that must never be changed via this endpoint
  const { id: _id, created_at: _createdAt, ...safeData } = data;

  const updated = await installersModel.update(id, safeData);
  logger.info(`[installers.service] Updated installer/tenant ${id}`);
  return updated;
}

module.exports = { list, getById, update };
