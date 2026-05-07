'use strict';

const { v4: uuidv4 } = require('uuid');
const devicesModel = require('./devices.model');
const db = require('../../shared/db/knex');
const { NotFoundError, ValidationError, UnauthorizedError } = require('../../shared/errors');
const logger = require('../../shared/logger');

/**
 * Business logic for the devices module.
 * All operations are tenant-scoped.
 */

/**
 * List all devices for a tenant, optionally filtered by status.
 * @param {string} tenantId
 * @param {{ status?: string }} [filters={}]
 * @returns {Promise<object[]>}
 */
async function list(tenantId, filters = {}) {
  const devices = await devicesModel.findAll(tenantId, filters);
  return devices.map(camelizeDevice);
}

/**
 * Convert a raw DB device row to camelCase API response.
 * Only exposes claimToken and hardwareId for unclaimed devices.
 * @param {object} device
 * @returns {object}
 */
function camelizeDevice(device) {
  const result = {
    id: device.id,
    tenantId: device.tenant_id,
    templateId: device.template_id,
    clientId: device.client_id,
    name: device.name,
    status: device.status,
    lastSeen: device.last_seen,
    metadata: device.metadata,
    createdAt: device.created_at,
    updatedAt: device.updated_at,
  };

  // Only expose claim token + hardware ID for unclaimed devices (provisioning)
  if (device.status === 'unclaimed') {
    result.claimToken = device.claim_token;
    result.hardwareId = device.hardware_id;
  } else {
    result.claimToken = null;
    result.hardwareId = null;
  }

  return result;
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
  return camelizeDevice(device);
}

/**
 * Create a new device.
 * @param {string} tenantId
 * @param {{ name: string, templateId?: string, clientId?: string, metadata?: object }} data
 * @returns {Promise<object>}
 */
async function create(tenantId, data) {
  if (!data.name) throw new ValidationError('Device name is required');

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

/**
 * Get provisioning credentials for an unclaimed device.
 * Returns the claim_token and hardware_id so the installer can
 * send them to the device over Web Serial.
 * @param {string} tenantId
 * @param {string} deviceId
 * @returns {Promise<{ claimToken: string, hardwareId: string|null }>}
 */
async function getProvisioningCredentials(tenantId, deviceId) {
  const device = await devicesModel.findById(tenantId, deviceId);
  if (!device) throw new NotFoundError(`Device not found: ${deviceId}`);
  if (device.status !== 'unclaimed') {
    throw new ValidationError('Device is not in unclaimed status — provisioning credentials are not available');
  }
  if (!device.claim_token) {
    throw new ValidationError('Device has no claim token — cannot generate provisioning credentials');
  }

  return {
    claimToken: device.claim_token,
    hardwareId: device.hardware_id || null,
  };
}

module.exports = { list, getById, create, update, remove, authenticate, getProvisioningCredentials };
