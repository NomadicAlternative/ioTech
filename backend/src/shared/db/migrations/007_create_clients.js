'use strict';

/**
 * Migration: 007_create_clients
 * Creates the `clients` table.
 * Clients are end-customers managed by an installer (tenant).
 */

/** @param {import('knex').Knex} knex */
exports.up = async function (knex) {
  await knex.schema.createTable('clients', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.string('email', 255).nullable();
    table.string('phone', 50).nullable();
    table.text('address').nullable();
    table.timestamps(true, true); // created_at, updated_at

    table.index(['tenant_id']);
  });

  // Partial unique index: (tenant_id, email) only when email is not null
  await knex.raw(
    'CREATE UNIQUE INDEX idx_clients_tenant_email ON clients (tenant_id, email) WHERE email IS NOT NULL'
  );
};

/** @param {import('knex').Knex} knex */
exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_clients_tenant_email');
  await knex.schema.dropTable('clients');
};
