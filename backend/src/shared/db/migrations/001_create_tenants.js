'use strict';

/**
 * Migration: 001_create_tenants
 * Creates the `tenants` table — root entity for multi-tenancy.
 * Every other business table references this via tenant_id FK.
 */

/** @param {import('knex').Knex} knex */
exports.up = async function (knex) {
  await knex.schema.createTable('tenants', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();
    table.string('email', 255).notNullable().unique();
    table.timestamps(true, true); // created_at, updated_at
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function (knex) {
  await knex.schema.dropTable('tenants');
};
