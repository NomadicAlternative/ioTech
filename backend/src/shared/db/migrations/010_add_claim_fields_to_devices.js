'use strict';

/**
 * Migration: 010_add_claim_fields_to_devices
 * Adds claim_token (string, unique, nullable), claimed_at (timestamp, nullable),
 * and hardware_id (string, nullable) to the devices table to support the device
 * claiming and WiFi provisioning flows.
 * Also changes the status column default from 'inactive' to 'unclaimed' so that
 * newly created devices start in the correct pre-claim state.
 */

/** @param {import('knex').Knex} knex */
exports.up = async function (knex) {
  await knex.schema.table('devices', (table) => {
    table.string('claim_token', 64).nullable().unique();
    table.timestamp('claimed_at').nullable();
    // hardware_id is set by the device during provisioning and used for mismatch checks
    table.string('hardware_id', 100).nullable();
    // Update the status default so new devices begin as 'unclaimed'
    table.string('status', 50).notNullable().defaultTo('unclaimed').alter();
    table.index(['claim_token']);
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function (knex) {
  await knex.schema.table('devices', (table) => {
    table.dropColumn('claim_token');
    table.dropColumn('claimed_at');
    table.dropColumn('hardware_id');
    // Revert status default back to the original value
    table.string('status', 50).notNullable().defaultTo('inactive').alter();
  });
};
