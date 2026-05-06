'use strict';

const { v4: uuidv4 } = require('uuid');
const db = require('../../shared/db/knex');
const rulesModel = require('./rules.model');
const { NotFoundError } = require('../../shared/errors');
const logger = require('../../shared/logger');

/**
 * Business logic for the rules module.
 * Converts between API camelCase and DB snake_case.
 */

// ─── Conversion helpers ───────────────────────────────────────────────────────

/**
 * Map a raw DB row (snake_case) to the public API shape (camelCase).
 * @param {object} row
 * @returns {object}
 */
function camelizeRule(row) {
  if (!row) return row;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
    triggerType: row.trigger_type,
    triggerConfig: row.trigger_config,
    actionType: row.action_type,
    actionConfig: row.action_config,
    cooldownMs: row.cooldown_ms,
    lastFiredAt: row.last_fired_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map API camelCase data to snake_case for the model.
 * @param {object} data
 * @returns {object}
 */
function snakeRule(data) {
  const result = {};
  if (data.name !== undefined) result.name = data.name;
  if (data.description !== undefined) result.description = data.description;
  if (data.enabled !== undefined) result.enabled = data.enabled;
  if (data.triggerType !== undefined) result.trigger_type = data.triggerType;
  if (data.triggerConfig !== undefined) result.trigger_config = data.triggerConfig;
  if (data.actionType !== undefined) result.action_type = data.actionType;
  if (data.actionConfig !== undefined) result.action_config = data.actionConfig;
  if (data.cooldownMs !== undefined) result.cooldown_ms = data.cooldownMs;
  return result;
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * List all rules for a tenant.
 * @param {string} tenantId
 * @param {object} [pagination]
 * @returns {Promise<object[]>}
 */
async function list(tenantId, pagination = {}) {
  const data = await rulesModel.findAll(tenantId, pagination);
  return data.map(camelizeRule);
}

/**
 * Get a single rule by ID, ensuring it belongs to the tenant.
 * @param {string} tenantId
 * @param {string} id
 * @returns {Promise<object>}
 */
async function getById(tenantId, id) {
  const rule = await rulesModel.findById(tenantId, id);
  if (!rule) throw new NotFoundError(`Rule not found: ${id}`);
  return camelizeRule(rule);
}

/**
 * Create a new automation rule.
 * @param {string} tenantId
 * @param {object} data — camelCase API fields
 * @returns {Promise<object>}
 */
async function create(tenantId, data) {
  const ruleData = {
    id: uuidv4(),
    tenant_id: tenantId,
    ...snakeRule(data),
    created_at: new Date(),
    updated_at: new Date(),
  };

  const rule = await rulesModel.insert(ruleData);
  logger.info(`[rules.service] Created rule ${rule.id} for tenant ${tenantId}`);
  return rule;
}

/**
 * Update an existing rule.
 * @param {string} tenantId
 * @param {string} id
 * @param {object} data — camelCase API fields to update
 * @returns {Promise<object>}
 */
async function update(tenantId, id, data) {
  // Ensure it exists and belongs to this tenant
  await getById(tenantId, id);

  const updated = await rulesModel.update(id, snakeRule(data));
  if (!updated) throw new NotFoundError(`Rule not found after update: ${id}`);

  logger.info(`[rules.service] Updated rule ${id} for tenant ${tenantId}`);
  return updated;
}

/**
 * Delete a rule.
 * @param {string} tenantId
 * @param {string} id
 * @returns {Promise<void>}
 */
async function remove(tenantId, id) {
  await getById(tenantId, id); // ensures tenant ownership
  await rulesModel.remove(id);
  logger.info(`[rules.service] Deleted rule ${id} for tenant ${tenantId}`);
}

module.exports = { list, getById, create, update, remove };
