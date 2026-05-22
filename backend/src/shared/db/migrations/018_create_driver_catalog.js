'use strict';

/**
 * Migration: 018_create_driver_catalog
 *
 * Creates the `driver_catalog` table — a registry of every sensor, actuator,
 * and display that ioTech supports.
 *
 * This table is the SOURCE OF TRUTH for the frontend catalog.
 * Adding a new driver to this table makes it visible to users.
 * It does NOT mean the driver is compiled in the firmware — that's
 * tracked by `firmware_status`.
 */

const DRIVER_STATUS_ENUM = 'driver_firmware_status';

/** @param {import('knex').Knex} knex */
exports.up = async function (knex) {
  await knex.raw(`CREATE TYPE ${DRIVER_STATUS_ENUM} AS ENUM (
    'available',   -- Driver compiled + validated with hardware
    'untested',    -- Driver compiled, no hardware test yet
    'planned',     -- Driver NOT compiled, requires firmware OTA
    'deprecated'   -- No longer supported
  )`);

  await knex.schema.createTable('driver_catalog', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('model', 32).notNullable().unique();   // "DHT22", "BME280"
    table.string('name', 128).notNullable();             // "Temperature & Humidity"
    table.string('category', 32).notNullable();           // "sensor", "actuator", "display"
    table.specificType('firmware_status', DRIVER_STATUS_ENUM).notNullable().defaultTo('planned');
    table.text('description').nullable();                 // User-facing description
    table.jsonb('datastreams').nullable();                // [{ key, name, type, direction, unit }]
    table.jsonb('config_schema').nullable();               // JSON schema for config (gpio, i2c_addr, etc.)
    table.string('icon', 32).nullable();                  // lucide-react icon name
    table.integer('sort_order').defaultTo(0);             // Display order in catalog
    table.timestamps(true, true);
  });

  // Index for catalog listing ordered by category + sort_order
  await knex.raw(`
    CREATE INDEX idx_driver_catalog_listing
    ON driver_catalog (category, sort_order)
    WHERE firmware_status != 'deprecated'
  `);
};

/** @param {import('knex').Knex} knex */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('driver_catalog');
  await knex.raw(`DROP TYPE IF EXISTS ${DRIVER_STATUS_ENUM}`);
};
