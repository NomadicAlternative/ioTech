'use strict';

/**
 * Migration: 017_add_super_admin_and_trial
 *
 * Four concurrent changes:
 *   1. Create `user_role` ENUM and alter `users.role` column
 *   2. Add trial columns to `tenants` (trial_ends_at, status, plan)
 *   3. Seed `admin@iotech.dev` as super_admin
 *   4. Seed existing tenants as `status='active'`
 *
 * Design decisions:
 *   - PG ENUMs for data integrity (not VARCHAR)
 *   - USING clause to cast existing varchar values to enum
 *   - Existing tenants seeded as 'active' — zero breakage (TRIAL-002)
 *   - Super admin seeded via UPSERT to handle re-runs safely
 */

const USER_ROLE_ENUM = 'user_role';
const TENANT_STATUS_ENUM = 'tenant_status';
const TENANT_PLAN_ENUM = 'tenant_plan';

/** @param {import('knex').Knex} knex */
exports.up = async function (knex) {
  // ── 1. Create ENUM types ─────────────────────────────────────────────────
  await knex.raw(`CREATE TYPE ${USER_ROLE_ENUM} AS ENUM ('installer', 'admin', 'super_admin')`);
  await knex.raw(`CREATE TYPE ${TENANT_STATUS_ENUM} AS ENUM ('trial', 'active', 'expired')`);
  await knex.raw(`CREATE TYPE ${TENANT_PLAN_ENUM} AS ENUM ('base', 'enterprise')`);

  // ── 2. Alter users.role ───────────────────────────────────────────────────
  // Must drop default first — PG can't auto-cast the old default to ENUM
  await knex.raw(`ALTER TABLE users ALTER COLUMN role DROP DEFAULT`);
  await knex.raw(`
    ALTER TABLE users
    ALTER COLUMN role TYPE ${USER_ROLE_ENUM}
    USING role::${USER_ROLE_ENUM}
  `);
  await knex.raw(`
    ALTER TABLE users
    ALTER COLUMN role SET DEFAULT 'installer'
  `);

  // ── 3. Add trial columns to tenants ───────────────────────────────────────
  await knex.schema.table('tenants', (table) => {
    table.specificType('trial_ends_at', 'timestamptz').nullable();
    table.specificType('status', TENANT_STATUS_ENUM).nullable();
    table.specificType('plan', TENANT_PLAN_ENUM).nullable().defaultTo('base');
  });

  // ── 4. Seed existing tenants as active (TRIAL-002) ────────────────────────
  await knex('tenants').whereNull('status').update({ status: 'active' });

  // ── 5. Set admin@iotech.dev as super_admin (AUTH-001) ────────────────────
  // Update if exists, insert if not (handles re-runs safely)
  const existingAdmin = await knex('users').where('email', 'admin@iotech.dev').first();
  if (existingAdmin) {
    await knex('users').where('email', 'admin@iotech.dev').update({ role: 'super_admin' });
  } else {
    const anyTenant = await knex('tenants').first();
    if (anyTenant) {
      await knex('users').insert({
        id: knex.raw('gen_random_uuid()'),
        tenant_id: anyTenant.id,
        email: 'admin@iotech.dev',
        password_hash: 'PLACEHOLDER_CHANGE_ME',
        role: 'super_admin',
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      });
    }
  }
};

/** @param {import('knex').Knex} knex */
exports.down = async function (knex) {
  // Drop trial columns from tenants
  await knex.schema.table('tenants', (table) => {
    table.dropColumn('plan');
    table.dropColumn('status');
    table.dropColumn('trial_ends_at');
  });

  // Revert users.role back to varchar
  await knex.raw(`
    ALTER TABLE users
    ALTER COLUMN role TYPE varchar(50)
    USING role::varchar(50)
  `);
  await knex.raw(`
    ALTER TABLE users
    ALTER COLUMN role SET DEFAULT 'installer'
  `);

  // Drop ENUM types (only after no columns reference them)
  await knex.raw(`DROP TYPE IF EXISTS ${TENANT_PLAN_ENUM}`);
  await knex.raw(`DROP TYPE IF EXISTS ${TENANT_STATUS_ENUM}`);
  await knex.raw(`DROP TYPE IF EXISTS ${USER_ROLE_ENUM}`);
};
