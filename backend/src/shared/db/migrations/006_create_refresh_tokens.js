'use strict';

/**
 * Migration: 006_create_refresh_tokens
 * Creates the `refresh_tokens` table for JWT refresh token rotation.
 * Enables server-side token revocation (logout, suspicious activity).
 */

/** @param {import('knex').Knex} knex */
exports.up = async function (knex) {
  await knex.schema.createTable('refresh_tokens', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    // token can be long (UUID v4 + signing) — varchar 500
    table.string('token', 500).notNullable().unique();
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['user_id']);
    table.index(['token']);
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function (knex) {
  await knex.schema.dropTable('refresh_tokens');
};
