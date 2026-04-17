'use strict';

/**
 * Migration: 013_create_dashboard_clients
 * Junction table between dashboards and clients for sharing.
 * RLS is scoped through the dashboard's installer_id.
 */

/** @param {import('knex').Knex} knex */
exports.up = async function (knex) {
  await knex.schema.createTable('dashboard_clients', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('dashboard_id')
      .notNullable()
      .references('id')
      .inTable('dashboards')
      .onDelete('CASCADE');
    table
      .uuid('client_id')
      .notNullable()
      .references('id')
      .inTable('clients')
      .onDelete('CASCADE');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.unique(['dashboard_id', 'client_id']);
  });

  // Enable RLS — policy scoped via join to dashboards.installer_id
  await knex.raw('ALTER TABLE dashboard_clients ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE dashboard_clients FORCE ROW LEVEL SECURITY');
  await knex.raw(`
    CREATE POLICY tenant_isolation ON dashboard_clients
      USING (
        EXISTS (
          SELECT 1 FROM dashboards
          WHERE dashboards.id = dashboard_clients.dashboard_id
            AND dashboards.installer_id = current_setting('app.tenant_id', true)::uuid
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM dashboards
          WHERE dashboards.id = dashboard_clients.dashboard_id
            AND dashboards.installer_id = current_setting('app.tenant_id', true)::uuid
        )
      )
  `);
};

/** @param {import('knex').Knex} knex */
exports.down = async function (knex) {
  await knex.raw('DROP POLICY IF EXISTS tenant_isolation ON dashboard_clients');
  await knex.schema.dropTableIfExists('dashboard_clients');
};
