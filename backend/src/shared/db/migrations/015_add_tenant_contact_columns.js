'use strict';

/**
 * Migration: 015_add_tenant_contact_columns
 * Adds contact_email (varchar) and metadata (JSONB, default '{}')
 * to the tenants table.
 *
 * These columns fix the installers module bug where update crashes
 * because contact_email and metadata are referenced in the schema
 * but don't exist in the database yet.
 */

/** @param {import('knex').Knex} knex */
exports.up = async function (knex) {
  await knex.schema.table('tenants', (table) => {
    table.string('contact_email', 255).nullable();
    table.jsonb('metadata').defaultTo('{}');
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function (knex) {
  await knex.schema.table('tenants', (table) => {
    table.dropColumn('contact_email');
    table.dropColumn('metadata');
  });
};
