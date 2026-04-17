'use strict';

/**
 * Migration: 011_create_firmware_versions
 * Creates the firmware_versions table for OTA firmware metadata.
 * Unique constraint on (version, hardware_model) per spec.
 */

/** @param {import('knex').Knex} knex */
exports.up = async function (knex) {
  await knex.schema.createTable('firmware_versions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('version', 20).notNullable();
    table.string('hardware_model', 100).notNullable();
    table.text('release_notes').nullable();
    table.text('download_url').notNullable();
    table.timestamps(true, true); // created_at, updated_at

    table.unique(['version', 'hardware_model']);
    table.index(['tenant_id']);
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('firmware_versions');
};
