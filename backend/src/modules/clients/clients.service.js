'use strict';

const { v4: uuidv4 } = require('uuid');
const clientsModel = require('./clients.model');
const { NotFoundError } = require('../../shared/errors');
const logger = require('../../shared/logger');

/**
 * Business logic for the clients module.
 * All operations are tenant-scoped.
 *
 * TODO: Requires `clients` table migration (see clients.model.js for schema).
 */

async function list(tenantId, pagination = {}) {
  const [data, total] = await Promise.all([
    clientsModel.findAll(tenantId, pagination),
    clientsModel.count(tenantId),
  ]);
  return { data, total };
}

async function getById(tenantId, id) {
  const client = await clientsModel.findById(tenantId, id);
  if (!client) throw new NotFoundError(`Client not found: ${id}`);
  return client;
}

async function create(tenantId, data) {
  const client = await clientsModel.insert({
    id: uuidv4(),
    tenant_id: tenantId,
    name: data.name,
    email: data.email || null,
    phone: data.phone || null,
    address: data.address || null,
    created_at: new Date(),
    updated_at: new Date(),
  });

  logger.info(`[clients.service] Created client ${client.id} for tenant ${tenantId}`);
  return client;
}

async function update(tenantId, id, data) {
  await getById(tenantId, id);

  const { tenant_id: _tenantId, created_at: _createdAt, ...safeData } = data;
  const updated = await clientsModel.update(id, safeData);
  if (!updated) throw new NotFoundError(`Client not found after update: ${id}`);

  logger.info(`[clients.service] Updated client ${id} for tenant ${tenantId}`);
  return updated;
}

async function remove(tenantId, id) {
  await getById(tenantId, id);
  await clientsModel.remove(id);
  logger.info(`[clients.service] Deleted client ${id} for tenant ${tenantId}`);
}

module.exports = { list, getById, create, update, remove };
