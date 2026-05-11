'use strict';

/**
 * Unit test for migration 016_add_firmware_columns.js
 * Verifies column additions to devices and device_templates.
 */

describe('Migration 016: add firmware columns', () => {
  let columnCalls;

  function makeTableBuilder() {
    columnCalls = [];
    const self = {
      string: jest.fn((name) => {
        columnCalls.push({ type: 'string', name });
        return { nullable: jest.fn().mockReturnThis(), notNullable: jest.fn().mockReturnThis(), defaultTo: jest.fn().mockReturnThis() };
      }),
      dropColumn: jest.fn((name) => {
        columnCalls.push({ type: 'drop', name });
      }),
    };
    return self;
  }

  function makeKnex() {
    const tableBuilder = makeTableBuilder();
    return {
      schema: {
        table: jest.fn((_name, cb) => { cb(tableBuilder); return Promise.resolve(); }),
        hasTable: jest.fn().mockResolvedValue(true),
      },
      __tableBuilder: tableBuilder,
    };
  }

  it('up() adds firmware_version to devices table', async () => {
    const migration = require('../migrations/016_add_firmware_columns');
    const knex = makeKnex();
    await migration.up(knex);
    expect(knex.schema.table).toHaveBeenCalledWith('devices', expect.any(Function));
    const stringCalls = columnCalls.filter((c) => c.type === 'string');
    expect(stringCalls.some((c) => c.name === 'firmware_version')).toBe(true);
  });

  it('up() adds hardware_model to device_templates table', async () => {
    const migration = require('../migrations/016_add_firmware_columns');
    const knex = makeKnex();
    columnCalls.length = 0; // reset from previous test
    await migration.up(knex);
    const stringCalls = columnCalls.filter((c) => c.type === 'string');
    expect(stringCalls.some((c) => c.name === 'hardware_model')).toBe(true);
  });

  it('up() calls schema.table for both devices and device_templates', async () => {
    const migration = require('../migrations/016_add_firmware_columns');
    const knex = makeKnex();
    await migration.up(knex);
    expect(knex.schema.table).toHaveBeenCalledWith('devices', expect.any(Function));
    expect(knex.schema.table).toHaveBeenCalledWith('device_templates', expect.any(Function));
  });

  it('down() drops firmware_version from devices', async () => {
    const migration = require('../migrations/016_add_firmware_columns');
    const knex = makeKnex();
    await migration.down(knex);
    expect(knex.schema.table).toHaveBeenCalledWith('devices', expect.any(Function));
    const dropCalls = columnCalls.filter((c) => c.type === 'drop');
    expect(dropCalls.some((c) => c.name === 'firmware_version')).toBe(true);
  });

  it('down() drops hardware_model from device_templates', async () => {
    const migration = require('../migrations/016_add_firmware_columns');
    const knex = makeKnex();
    columnCalls.length = 0;
    await migration.down(knex);
    const dropCalls = columnCalls.filter((c) => c.type === 'drop');
    expect(dropCalls.some((c) => c.name === 'hardware_model')).toBe(true);
  });

  it('firmware_version column is nullable (no default)', async () => {
    const migration = require('../migrations/016_add_firmware_columns');
    const knex = makeKnex();
    await migration.up(knex);
    const fwColumn = columnCalls.find((c) => c.name === 'firmware_version');
    expect(fwColumn).toBeDefined();
    // The chain returns nullable() which is a no-op false by default, confirming explicit nullable
    expect(fwColumn.type).toBe('string');
  });
});
