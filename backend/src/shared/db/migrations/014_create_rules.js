'use strict';

/**
 * Migration: 014_create_rules
 * Creates the `rules` table for Phase 6 — Automation Rules.
 *
 * Rules are tenant-scoped automation configurations that:
 * - Evaluate telemetry data against threshold conditions
 * - Evaluate device status transitions
 * - Execute actions (MQTT commands) when conditions are met
 * - Respect cooldown periods to prevent action storms
 */

/** @param {import('knex').Knex} knex */
exports.up = async function (knex) {
  await knex.schema.createTable('rules', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('tenant_id')
      .notNullable()
      .references('id')
      .inTable('tenants')
      .onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.string('description', 1024).nullable();
    table.boolean('enabled').notNullable().defaultTo(true);
    table.string('trigger_type', 50).notNullable(); // 'threshold' | 'status'
    table.jsonb('trigger_config').notNullable().defaultTo('{}');
    table.string('action_type', 50).notNullable(); // 'relay' | 'command'
    table.jsonb('action_config').notNullable().defaultTo('{}');
    table.integer('cooldown_ms').notNullable().defaultTo(0);
    table.timestamp('last_fired_at').nullable();
    table.timestamps(true, true); // created_at, updated_at

    table.index(['tenant_id']);
    table.index(['tenant_id', 'enabled']);
  });

  // ── RLS ────────────────────────────────────────────────────────────────────
  await knex.raw('ALTER TABLE rules ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE rules FORCE ROW LEVEL SECURITY');
  await knex.raw(`
    CREATE POLICY tenant_isolation ON rules
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
  `);
};

/** @param {import('knex').Knex} knex */
exports.down = async function (knex) {
  await knex.raw('DROP POLICY IF EXISTS tenant_isolation ON rules');
  await knex.raw('ALTER TABLE rules DISABLE ROW LEVEL SECURITY');
  await knex.schema.dropTableIfExists('rules');
};
