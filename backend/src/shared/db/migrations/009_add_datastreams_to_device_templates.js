'use strict';

/**
 * Migration: 009_add_datastreams_to_device_templates
 *
 * Adds a `datastreams` JSONB column to `device_templates`.
 * Existing rows get an empty array by default.
 * The `schema` column is preserved for backwards compatibility (deprecated, not removed).
 *
 * Rollback: drops the `datastreams` column.
 */

/** @param {import('knex').Knex} knex */
exports.up = async function (knex) {
  await knex.schema.alterTable('device_templates', (table) => {
    table.jsonb('datastreams').notNullable().defaultTo('[]');
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function (knex) {
  await knex.schema.alterTable('device_templates', (table) => {
    table.dropColumn('datastreams');
  });
};
