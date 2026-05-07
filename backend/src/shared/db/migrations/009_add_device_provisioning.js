'use strict';

/**
 * Migration: 009_add_device_provisioning
 *
 * Adds columns for the Web Serial provisioning flow:
 * - `claim_token`: unique token that identifies a device awaiting provisioning.
 *   An installer scans/provides this from the device's serial output.
 * - `hardware_id`: unique hardware identifier (e.g. chip MAC, serial number)
 *   extracted from the device during provisioning.
 *
 * Also updates the status enum to support provisioning states:
 * - 'unclaimed': device exists but hasn't been provisioned yet
 * - 'claimed': provisioning started but not complete
 * - 'active': fully provisioned and online
 * - 'inactive': previously active but currently offline
 */

/** @param {import('knex').Knex} knex */
exports.up = async function (knex) {
  // Add claim_token column (unique, nullable — only set for unclaimed devices)
  await knex.schema.alterTable('devices', (table) => {
    table.string('claim_token', 255).nullable().unique();
    table.string('hardware_id', 255).nullable().unique();
    table.index('claim_token');
    table.index('hardware_id');
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function (knex) {
  await knex.schema.alterTable('devices', (table) => {
    table.dropColumn('claim_token');
    table.dropColumn('hardware_id');
  });
};
