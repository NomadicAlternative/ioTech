'use strict';

const { v4: uuidv4 } = require('uuid');
const devicesModel = require('./devices.model');
const db = require('../../shared/db/knex');
const { NotFoundError, UnauthorizedError, ConflictError } = require('../../shared/errors');
const logger = require('../../shared/logger');
const { getClient: getMqttClient } = require('../../mqtt/mqttClient');

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
    status: 'unclaimed',
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
 * Claim an unclaimed device using its claim_token.
 * Sets status='claimed', claimed_at, and assigns tenant_id.
 * @param {string} tenantId   - The tenant claiming the device
 * @param {string} claimToken - The claim token from the device
 * @returns {Promise<object>} Updated device record
 */
async function claimDevice(tenantId, claimToken) {
  const device = await devicesModel.findByClaimToken(claimToken);
  if (!device) throw new NotFoundError(`No device found with claim_token: ${claimToken}`);
  if (device.status !== 'unclaimed') {
    throw new ConflictError('device_already_claimed');
  }

  const updated = await devicesModel.update(device.id, {
    status: 'claimed',
    tenant_id: tenantId,
    claimed_at: new Date(),
  });

  logger.info(`[devices.service] Device ${device.id} claimed by tenant ${tenantId}`);
  return updated;
}

module.exports = { list, getById, create, update, remove, authenticate, claimDevice, sendCommand };

/**
 * Send a command to a device via MQTT.
 * Validates device exists and belongs to tenant, then publishes to MQTT.
 * @param {string} tenantId
 * @param {string} deviceId
 * @param {{ action: string, payload?: object }} command
 * @returns {Promise<{ ok: true, topic: string }>}
 */
async function sendCommand(tenantId, deviceId, command) {
  await getById(tenantId, deviceId); // ensures device exists and belongs to tenant

  const topic = `devices/${deviceId}/command`;
  const mqttClient = getMqttClient();

  if (mqttClient) {
    mqttClient.publish(topic, JSON.stringify(command), { qos: 1 });
    logger.info(`[devices.service] Published command to ${topic}: action=${command.action}`);
  } else {
    logger.warn(`[devices.service] MQTT client not available — command for ${deviceId} not sent`);
  }

  return { ok: true, topic };
}
