'use strict';

const { v4: uuidv4 } = require('uuid');
const firmwareModel = require('./firmware.model');
const logger = require('../../shared/logger');
const { NotFoundError, ConflictError } = require('../../shared/errors');

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

module.exports = { list, getById, create, update, remove };
