'use strict';

const { v4: uuidv4 } = require('uuid');
const firmwareModel = require('./firmware.model');
const devicesModel = require('../devices/devices.model');
const templatesModel = require('../device-templates/device-templates.model');
const { getClient: getMqttClient } = require('../../mqtt/mqttClient');
const logger = require('../../shared/logger');
const { NotFoundError, ConflictError } = require('../../shared/errors');
const { getLocalIp } = require('../../shared/network');

function resolveUrl(downloadUrl) {
  if (!downloadUrl) return downloadUrl;
  if (downloadUrl.startsWith('http://') || downloadUrl.startsWith('https://')) return downloadUrl;
  const ip = getLocalIp();
  const port = process.env.PORT || 3000;
  return `http://${ip}:${port}${downloadUrl}`;
}

async function list(tenantId) {
  return firmwareModel.findAll(tenantId);
}

async function getById(tenantId, id) {
  const fw = await firmwareModel.findById(tenantId, id);
  if (!fw) throw new NotFoundError(`Firmware not found: ${id}`);
  return fw;
}

async function create(tenantId, data) {
  const existing = await firmwareModel.findByVersionAndModel(data.version, data.hardware_model);
  if (existing) throw new ConflictError(`Firmware version ${data.version}+${data.hardware_model} already exists`);

  const fw = await firmwareModel.insert({
    id: uuidv4(),
    tenant_id: tenantId,
    version: data.version,
    hardware_model: data.hardware_model,
    release_notes: data.release_notes || null,
    download_url: data.download_url,
    created_at: new Date(),
    updated_at: new Date(),
  });

  logger.info(`[firmware.service] Created firmware ${fw.id} for tenant ${tenantId}`);
  return fw;
}

async function update(tenantId, id, data) {
  await getById(tenantId, id);
  const updated = await firmwareModel.update(id, data);
  logger.info(`[firmware.service] Updated firmware ${id}`);
  return updated;
}

async function remove(tenantId, id) {
  await getById(tenantId, id);
  await firmwareModel.remove(id);
  logger.info(`[firmware.service] Deleted firmware ${id}`);
}

/**
 * Check if a newer firmware version is available for a hardware model.
 * Device-facing endpoint — no tenant scoping needed.
 *
 * @param {string} currentVersion  — the device's current firmware version (optional)
 * @param {string} hardwareModel   — the device's hardware model (required)
 * @returns {Promise<{ version: string, url: string }|{ upToDate: true }>}
 */
async function checkLatest(currentVersion, hardwareModel) {
  if (!hardwareModel) {
    throw new NotFoundError('hardware_model is required');
  }

  const latest = await firmwareModel.findLatestByHardwareModel(hardwareModel);

  if (!latest || latest.version === currentVersion) {
    return { upToDate: true };
  }

  return { version: latest.version, url: resolveUrl(latest.download_url) };
}

/**
 * Trigger an OTA update for a device.
 * Resolves the device → template → hardware_model → latest firmware,
 * publishes MQTT, and updates the device record.
 *
 * @param {string} tenantId
 * @param {string} deviceId
 * @param {string} [requestedVersion]  — optional specific version to install
 * @returns {Promise<{ ok: true, firmware: { version: string, url: string } }>}
 */
async function triggerOta(tenantId, deviceId, requestedVersion) {
  // 1. Resolve device
  const device = await devicesModel.findById(tenantId, deviceId);
  if (!device) throw new NotFoundError(`Device not found: ${deviceId}`);

  // 2. Resolve template → hardware_model
  const template = await templatesModel.findById(tenantId, device.template_id);
  if (!template || !template.hardware_model) {
    throw new NotFoundError('template_missing_hardware_model');
  }

  // 3. Resolve latest firmware
  const latest = await firmwareModel.findLatestByHardwareModel(template.hardware_model);
  if (!latest) {
    throw new NotFoundError(`No firmware found for hardware_model: ${template.hardware_model}`);
  }

  const targetVersion = requestedVersion || latest.version;
  const firmwareInfo = { version: targetVersion, url: resolveUrl(latest.download_url) };

  // 4. Publish MQTT
  const mqttClient = getMqttClient();
  if (!mqttClient) {
    throw new NotFoundError('mqtt_unavailable');
  }

  const topic = `org/${tenantId}/device/${deviceId}/ota/notify`;
  mqttClient.publish(topic, JSON.stringify(firmwareInfo), { qos: 1 });
  logger.info(`[firmware.service] Published OTA notify to ${topic}: ${JSON.stringify(firmwareInfo)}`);

  // 5. Update device firmware_version
  await devicesModel.update(deviceId, { firmware_version: targetVersion });

  return { ok: true, firmware: firmwareInfo };
}

module.exports = { list, getById, create, update, remove, checkLatest, triggerOta };
