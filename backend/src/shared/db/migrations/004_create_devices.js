'use strict';

/**
 * Migration: 004_create_devices
 * Creates the `devices` table.
 * device_token is used for broker authentication (lightweight device auth).
 * client_id is nullable — will be FK'd to clients table in a later migration.
 */

/** @param {import('knex').Knex} knex */
exports.up = async function (knex) {
  await knex.schema.createTable('devices', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table
      .uuid('template_id')
      .nullable()
      .references('id')
      .inTable('device_templates')
      .onDelete('SET NULL');
    // client_id nullable — FK to clients table added in a future migration
    table.uuid('client_id').nullable();
    // Unique token for broker/device auth
    table.string('device_token', 255).notNullable().unique();
    table.string('name', 255).notNullable();
    table.string('status', 50).notNullable().defaultTo('inactive');
    table.timestamp('last_seen').nullable();
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table.timestamps(true, true); // created_at, updated_at

    table.index(['tenant_id']);
    table.index(['device_token']);
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function (knex) {
  await knex.schema.dropTable('devices');
};
