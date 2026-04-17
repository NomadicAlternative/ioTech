'use strict';

const { v4: uuidv4 } = require('uuid');
const devicesModel = require('./devices.model');
const db = require('../../shared/db/knex');
const { NotFoundError, UnauthorizedError } = require('../../shared/errors');
const logger = require('../../shared/logger');

/**
 * Business logic for the devices module.
 * All operations are tenant-scoped.
 */

/**
 * List all devices for a tenant, with pagination.
 * @param {string} tenantId
 * @param {{ page: number, limit: number, sortBy: string|null, sortDir: string }} [pagination]
 * @returns {Promise<{ data: object[], total: number }>}
 */
async function list(tenantId, pagination = {}) {
  const [data, total] = await Promise.all([
    devicesModel.findAll(tenantId, pagination),
    devicesModel.count(tenantId),
  ]);
  return { data, total };
}

/**
 * Get a single device by ID, ensuring it belongs to the requesting tenant.
 * @param {string} tenantId
 * @param {string} id
 * @returns {Promise<object>}
 */
async function getById(tenantId, id) {
  const device = await devicesModel.findById(tenantId, id);
  if (!device) throw new NotFoundError(`Device not found: ${id}`);
  return device;
}

/**
 * Create a new device.
 * @param {string} tenantId
 * @param {{ name: string, templateId?: string, clientId?: string, metadata?: object }} data
 * @returns {Promise<object>}
 */
async function create(tenantId, data) {
  const device = await devicesModel.insert({
    id: uuidv4(),
    tenant_id: tenantId,
    template_id: data.templateId || null,
    client_id: data.clientId || null,
    device_token: uuidv4(), // auto-generated secure token
    name: data.name,
    status: 'inactive',
    metadata: data.metadata || {},
    created_at: new Date(),
    updated_at: new Date(),
  });

  logger.info(`[devices.service] Created device ${device.id} for tenant ${tenantId}`);
  return device;
}

/**
 * Update an existing device.
 * @param {string} tenantId
 * @param {string} id
 * @param {object} data  — fields to update
 * @returns {Promise<object>}
 */
async function update(tenantId, id, data) {
  // Ensure it exists and belongs to this tenant before updating
  await getById(tenantId, id);

  // Strip read-only fields from update payload
  const { tenant_id: _tenantId, device_token: _deviceToken, created_at: _createdAt, ...safeData } = data;

  const updated = await devicesModel.update(id, safeData);
  if (!updated) throw new NotFoundError(`Device not found after update: ${id}`);

  logger.info(`[devices.service] Updated device ${id} for tenant ${tenantId}`);
  return updated;
}

/**
 * Delete a device.
 * @param {string} tenantId
 * @param {string} id
 * @returns {Promise<void>}
 */
async function remove(tenantId, id) {
  await getById(tenantId, id); // ensures tenant ownership
  await devicesModel.remove(id);
  logger.info(`[devices.service] Deleted device ${id} for tenant ${tenantId}`);
}

/**
 * Authenticate a device by its device_token.
 * Used by the device-facing API endpoint.
 * @param {string} deviceId
 * @param {string} deviceToken
 * @returns {Promise<{ ok: true, device: object }>}
 */
async function authenticate(deviceId, deviceToken) {
  // Direct lookup — not tenant-scoped because the device authenticates itself
  const found = await db('devices')
    .where({ id: deviceId, device_token: deviceToken, status: 'active' })
    .first();

  if (!found) {
    throw new UnauthorizedError('Invalid device credentials');
  }

  return { ok: true, device: found };
}

module.exports = { list, getById, create, update, remove, authenticate };
