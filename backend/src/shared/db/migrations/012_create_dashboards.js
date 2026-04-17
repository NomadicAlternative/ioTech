'use strict';

/**
 * Migration: 012_create_dashboards
 * Creates the dashboards table with RLS policy scoped to installer_id.
 */

/** @param {import('knex').Knex} knex */
exports.up = async function (knex) {
  await knex.schema.createTable('dashboards', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();
    table.text('description').nullable();
    table
      .jsonb('layout')
      .notNullable()
      .defaultTo(JSON.stringify({ widgets: [], gridConfig: {} }));
    table.uuid('installer_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamps(true, true); // created_at, updated_at
  });

  // Enable RLS
  await knex.raw('ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE dashboards FORCE ROW LEVEL SECURITY');
  await knex.raw(`
    CREATE POLICY tenant_isolation ON dashboards
      USING (installer_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (installer_id = current_setting('app.tenant_id', true)::uuid)
  `);
};

/** @param {import('knex').Knex} knex */
exports.down = async function (knex) {
  await knex.raw('DROP POLICY IF EXISTS tenant_isolation ON dashboards');
  await knex.schema.dropTableIfExists('dashboards');
};
