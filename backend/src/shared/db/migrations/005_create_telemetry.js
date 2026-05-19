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
  // Enable TimescaleDB extension (idempotent, fails gracefully if unavailable).
  // Wrapped in a savepoint so a missing extension doesn't abort the migration transaction.
  let timescaleAvailable = false;
  try {
    await knex.raw('SAVEPOINT timescale_create');
    await knex.raw('CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE');
    await knex.raw('RELEASE SAVEPOINT timescale_create');
    timescaleAvailable = true;
  } catch {
    await knex.raw('ROLLBACK TO SAVEPOINT timescale_create');
    console.warn(
      '[005_create_telemetry] TimescaleDB extension not available — creating regular table (suitable for dev/test)'
    );
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

  // Convert to TimescaleDB hypertable — chunk_time_interval = 1 week (only if available)
  if (timescaleAvailable) {
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
