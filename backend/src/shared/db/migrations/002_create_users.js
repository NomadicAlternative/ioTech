'use strict';

/**
 * Migration: 002_create_users
 * Creates the `users` table scoped to a tenant.
 * Enforces (tenant_id, email) uniqueness — same email allowed across tenants.
 */

/** @param {import('knex').Knex} knex */
exports.up = async function (knex) {
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('email', 255).notNullable();
    table.string('password_hash', 255).notNullable();
    table.string('role', 50).notNullable().defaultTo('installer');
    table.timestamps(true, true); // created_at, updated_at

    // Unique email per tenant
    table.unique(['tenant_id', 'email']);
    // Index for tenant-scoped queries
    table.index(['tenant_id']);
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function (knex) {
  await knex.schema.dropTable('users');
};
