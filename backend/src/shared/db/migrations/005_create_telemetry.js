'use strict';

/**
 * Migration: 005_create_telemetry
 * Creates the `telemetry` table and converts it to a TimescaleDB hypertable
 * partitioned on received_at with 1-week chunk intervals.
 *
 * Requires: TimescaleDB extension enabled on the PostgreSQL instance.
 * The migration enables the extension if not already present.
 */

/** @param {import('knex').Knex} knex */
exports.up = async function (knex) {
  // Check if TimescaleDB is available (without failing the transaction)
  const { rows } = await knex.raw(
    "SELECT count(*)::int AS cnt FROM pg_available_extensions WHERE name = 'timescaledb'"
  );
  const hasTimescale = rows[0]?.cnt > 0;

  if (hasTimescale) {
    await knex.raw('CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE');
  } else {
    console.warn('TimescaleDB not available — telemetry will use a regular table');
  }

  await knex.schema.createTable('telemetry', (table) => {
    // bigserial PK — knex maps .bigIncrements() to bigserial
    table.bigIncrements('id').primary();
    table.uuid('device_id').notNullable().references('id').inTable('devices').onDelete('CASCADE');
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.jsonb('data').notNullable();
    // timestamptz — partition column for TimescaleDB
    table.timestamp('received_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['device_id', 'received_at']);
    table.index(['tenant_id']);
  });

  // Convert to TimescaleDB hypertable if available
  if (hasTimescale) {
    await knex.raw(
      "SELECT create_hypertable('telemetry', 'received_at', chunk_time_interval => INTERVAL '1 week')"
    );
  }
};

/** @param {import('knex').Knex} knex */
exports.down = async function (knex) {
  // Drop the table — TimescaleDB handles hypertable cleanup automatically
  await knex.schema.dropTable('telemetry');
};
