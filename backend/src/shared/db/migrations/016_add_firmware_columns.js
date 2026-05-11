'use strict';

/**
 * Migration: 016_add_firmware_columns
 * Adds firmware_version (varchar) to devices table and
 * hardware_model (varchar) to device_templates table.
 * Both are nullable — legacy rows are unaffected.
 */

/** @param {import('knex').Knex} knex */
exports.up = async function (knex) {
  await knex.schema.table('devices', (table) => {
    table.string('firmware_version', 20).nullable();
  });

  await knex.schema.table('device_templates', (table) => {
    table.string('hardware_model', 100).nullable();
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function (knex) {
  await knex.schema.table('devices', (table) => {
    table.dropColumn('firmware_version');
  });

  await knex.schema.table('device_templates', (table) => {
    table.dropColumn('hardware_model');
  });
};
