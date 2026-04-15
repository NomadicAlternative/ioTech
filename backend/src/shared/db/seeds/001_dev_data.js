'use strict';

const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

/**
 * Seed: 001_dev_data
 * Creates baseline development/test data:
 *   - 1 tenant  (Demo Installer)
 *   - 1 user    (admin@iotech.dev, role: installer)
 *   - 1 device template (ESP32 Weather Station)
 *   - 1 device  (ESP32-DEV-001, status: active)
 *
 * Safe to run multiple times — checks for existence before inserting.
 */

const TENANT_EMAIL = 'demo@iotech.dev';
const USER_EMAIL = 'admin@iotech.dev';
const DEVICE_TOKEN = 'dev-token-esp32-001';

/** @param {import('knex').Knex} knex */
exports.seed = async function (knex) {
  // ── 1. Tenant ──────────────────────────────────────────────────────────────
  let tenant = await knex('tenants').where({ email: TENANT_EMAIL }).first();
  if (!tenant) {
    const [inserted] = await knex('tenants')
      .insert({
        id: uuidv4(),
        name: 'Demo Installer',
        email: TENANT_EMAIL,
      })
      .returning('*');
    tenant = inserted;
  }

  // ── 2. User ─────────────────────────────────────────────────────────────────
  const existingUser = await knex('users')
    .where({ tenant_id: tenant.id, email: USER_EMAIL })
    .first();

  if (!existingUser) {
    const passwordHash = await bcrypt.hash('changeme123', 10);
    await knex('users').insert({
      id: uuidv4(),
      tenant_id: tenant.id,
      email: USER_EMAIL,
      password_hash: passwordHash,
      role: 'installer',
    });
  }

  // ── 3. Device Template ──────────────────────────────────────────────────────
  let template = await knex('device_templates')
    .where({ tenant_id: tenant.id, name: 'ESP32 Weather Station' })
    .first();

  if (!template) {
    const [inserted] = await knex('device_templates')
      .insert({
        id: uuidv4(),
        tenant_id: tenant.id,
        name: 'ESP32 Weather Station',
        description: 'ESP32-based weather monitoring device with temperature and humidity sensors.',
        schema: JSON.stringify({
          sensors: [
            { key: 'temperature', type: 'float', unit: '°C', min: -40, max: 85 },
            { key: 'humidity', type: 'float', unit: '%', min: 0, max: 100 },
          ],
          actuators: [],
          config: [{ key: 'reporting_interval_ms', type: 'integer', default: 30000 }],
        }),
      })
      .returning('*');
    template = inserted;
  }

  // ── 4. Device ────────────────────────────────────────────────────────────────
  const existingDevice = await knex('devices')
    .where({ tenant_id: tenant.id, device_token: DEVICE_TOKEN })
    .first();

  if (!existingDevice) {
    await knex('devices').insert({
      id: uuidv4(),
      tenant_id: tenant.id,
      template_id: template.id,
      client_id: null,
      device_token: DEVICE_TOKEN,
      name: 'ESP32-DEV-001',
      status: 'active',
      last_seen: null,
      metadata: JSON.stringify({ location: 'Lab', firmware: '1.0.0' }),
    });
  }
};
