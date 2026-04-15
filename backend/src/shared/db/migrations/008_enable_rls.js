'use strict';

/**
 * Migration: 008_enable_rls
 * Enables Row Level Security (RLS) on all tenant-scoped tables.
 *
 * Tables covered:
 *   - tenants         (special: policy on id column — a tenant can only see itself)
 *   - users           (tenant_id column)
 *   - devices         (tenant_id column)
 *   - device_templates (tenant_id column)
 *   - telemetry       (tenant_id column)
 *   - clients         (tenant_id column)
 *
 * Skipped: refresh_tokens — has user_id (not tenant_id); join-based RLS adds
 *   complexity without meaningful security benefit since the table is only
 *   accessed server-side via authenticated service functions.
 *
 * RLS is enforced when the app DB user (iotech_app) runs queries.
 * The app sets `app.tenant_id` per transaction via withTenant() helper.
 *
 * Requires: DB user running this migration must be a superuser or table owner
 * with BYPASSRLS privilege to set up the policies.
 */

/** @param {import('knex').Knex} knex */
exports.up = async function (knex) {
  // ── tenants ──────────────────────────────────────────────────────────────
  // A tenant row can only be seen/modified by the tenant itself.
  await knex.raw('ALTER TABLE tenants ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE tenants FORCE ROW LEVEL SECURITY');
  await knex.raw(`
    CREATE POLICY tenant_isolation ON tenants
      USING (id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (id = current_setting('app.tenant_id', true)::uuid)
  `);

  // ── users ─────────────────────────────────────────────────────────────────
  await knex.raw('ALTER TABLE users ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE users FORCE ROW LEVEL SECURITY');
  await knex.raw(`
    CREATE POLICY tenant_isolation ON users
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
  `);

  // ── devices ───────────────────────────────────────────────────────────────
  await knex.raw('ALTER TABLE devices ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE devices FORCE ROW LEVEL SECURITY');
  await knex.raw(`
    CREATE POLICY tenant_isolation ON devices
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
  `);

  // ── device_templates ──────────────────────────────────────────────────────
  await knex.raw('ALTER TABLE device_templates ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE device_templates FORCE ROW LEVEL SECURITY');
  await knex.raw(`
    CREATE POLICY tenant_isolation ON device_templates
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
  `);

  // ── telemetry ─────────────────────────────────────────────────────────────
  await knex.raw('ALTER TABLE telemetry ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE telemetry FORCE ROW LEVEL SECURITY');
  await knex.raw(`
    CREATE POLICY tenant_isolation ON telemetry
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
  `);

  // ── clients ───────────────────────────────────────────────────────────────
  await knex.raw('ALTER TABLE clients ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE clients FORCE ROW LEVEL SECURITY');
  await knex.raw(`
    CREATE POLICY tenant_isolation ON clients
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
  `);
};

/** @param {import('knex').Knex} knex */
exports.down = async function (knex) {
  // Drop policies then disable RLS — reverse order of creation

  const tables = ['clients', 'telemetry', 'device_templates', 'devices', 'users', 'tenants'];

  for (const table of tables) {
    await knex.raw(`DROP POLICY IF EXISTS tenant_isolation ON ${table}`);
    await knex.raw(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`);
  }
};
