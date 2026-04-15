'use strict';

const { v4: uuidv4 } = require('uuid');
const templatesModel = require('./device-templates.model');
const { NotFoundError, ValidationError } = require('../../shared/errors');
const logger = require('../../shared/logger');

async function list(tenantId) {
  return templatesModel.findAll(tenantId);
}

async function getById(tenantId, id) {
  const template = await templatesModel.findById(tenantId, id);
  if (!template) throw new NotFoundError(`Device template not found: ${id}`);
  return template;
}

async function create(tenantId, data) {
  if (!data.name) throw new ValidationError('Template name is required');

  const template = await templatesModel.insert({
    id: uuidv4(),
    tenant_id: tenantId,
    name: data.name,
    description: data.description || null,
    schema: data.schema || {},
    created_at: new Date(),
    updated_at: new Date(),
  });

  logger.info(`[device-templates.service] Created template ${template.id} for tenant ${tenantId}`);
  return template;
}

async function update(tenantId, id, data) {
  await getById(tenantId, id); // ensures tenant ownership

  const { tenant_id: _tenantId, created_at: _createdAt, ...safeData } = data;
  const updated = await templatesModel.update(id, safeData);
  if (!updated) throw new NotFoundError(`Template not found after update: ${id}`);

  logger.info(`[device-templates.service] Updated template ${id} for tenant ${tenantId}`);
  return updated;
}

async function remove(tenantId, id) {
  await getById(tenantId, id);
  await templatesModel.remove(id);
  logger.info(`[device-templates.service] Deleted template ${id} for tenant ${tenantId}`);
}

module.exports = { list, getById, create, update, remove };
