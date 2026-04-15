'use strict';

/**
 * Migration: 003_create_device_templates
 * Creates the `device_templates` table.
 * Templates define the schema (sensors, actuators, config) for a class of devices.
 */

/** @param {import('knex').Knex} knex */
exports.up = async function (knex) {
  await knex.schema.createTable('device_templates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.text('description').nullable();
    // jsonb schema — defines sensors, actuators, config fields
    table.jsonb('schema').notNullable().defaultTo('{}');
    table.timestamps(true, true); // created_at, updated_at

    table.index(['tenant_id']);
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function (knex) {
  await knex.schema.dropTable('device_templates');
};
