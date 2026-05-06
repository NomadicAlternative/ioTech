'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * Seed: 002_rules
 * Creates sample automation rules for the dev tenant.
 *
 * Rules created:
 *   1. "High Temperature → Fan On" — threshold trigger, relay action
 *   2. "Offline → Alert Relay" — status trigger, relay action
 *
 * Safe to run multiple times — checks for existence before inserting.
 */

const TENANT_EMAIL = 'demo@iotech.dev';
const RULE_NAMES = ['High Temperature → Fan On', 'Offline → Alert Relay'];

/** @param {import('knex').Knex} knex */
exports.seed = async function (knex) {
  // ── 1. Resolve the dev tenant ──────────────────────────────────────────────
  const tenant = await knex('tenants').where({ email: TENANT_EMAIL }).first();
  if (!tenant) {
    console.warn('[seed:002_rules] Dev tenant not found — skipping rule seeds');
    return;
  }

  // ── 2. Check if rules already exist ────────────────────────────────────────
  const existing = await knex('rules')
    .where({ tenant_id: tenant.id })
    .whereIn('name', RULE_NAMES);

  if (existing.length >= RULE_NAMES.length) {
    console.log('[seed:002_rules] Rules already exist — skipping');
    return;
  }

  // ── 3. Resolve the dev device (for context) ────────────────────────────────
  const device = await knex('devices')
    .where({ tenant_id: tenant.id })
    .first();

  if (!device) {
    console.warn('[seed:002_rules] No device found for tenant — skipping rule seeds');
    return;
  }

  // ── 4. Insert rules ────────────────────────────────────────────────────────
  const now = new Date();

  const rules = [
    {
      id: uuidv4(),
      tenant_id: tenant.id,
      name: 'High Temperature → Fan On',
      description: 'Automatically turn on fan relay when temperature exceeds 30°C',
      enabled: true,
      trigger_type: 'threshold',
      trigger_config: JSON.stringify({
        field: 'temperature',
        operator: 'gt',
        value: 30,
      }),
      action_type: 'relay',
      action_config: JSON.stringify({ relay: 1, state: true }),
      cooldown_ms: 60000,
      last_fired_at: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      tenant_id: tenant.id,
      name: 'Offline → Alert Relay',
      description: 'Activate relay 2 when a device goes offline',
      enabled: true,
      trigger_type: 'status',
      trigger_config: JSON.stringify({ status: 'offline' }),
      action_type: 'relay',
      action_config: JSON.stringify({ relay: 2, state: true }),
      cooldown_ms: 60000,
      last_fired_at: null,
      created_at: now,
      updated_at: now,
    },
  ];

  for (const rule of rules) {
    // Check individually
    const dup = await knex('rules')
      .where({ tenant_id: tenant.id, name: rule.name })
      .first();

    if (!dup) {
      await knex('rules').insert(rule);
      console.log(`[seed:002_rules] Inserted rule: ${rule.name}`);
    }
  }
};
