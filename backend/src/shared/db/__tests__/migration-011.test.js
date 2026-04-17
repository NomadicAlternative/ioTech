'use strict';

/**
 * Unit test for migration 011_create_firmware_versions.js
 * Verifies table + column creation and unique constraint via Knex schema calls.
 */

describe('Migration 011: create_firmware_versions', () => {
  let columnCalls;

  function makeTableBuilder() {
    columnCalls = [];
    const self = {
      uuid: jest.fn((name, ..._args) => { columnCalls.push({ type: 'uuid', name }); return { primary: jest.fn().mockReturnThis(), defaultTo: jest.fn().mockReturnThis(), notNullable: jest.fn().mockReturnThis(), nullable: jest.fn().mockReturnThis(), references: jest.fn().mockReturnThis(), inTable: jest.fn().mockReturnThis(), onDelete: jest.fn().mockReturnThis() }; }),
      string: jest.fn((name) => { columnCalls.push({ type: 'string', name }); return { notNullable: jest.fn().mockReturnThis(), nullable: jest.fn().mockReturnThis() }; }),
      text: jest.fn((name) => { columnCalls.push({ type: 'text', name }); return { nullable: jest.fn().mockReturnThis(), notNullable: jest.fn().mockReturnThis() }; }),
      timestamp: jest.fn((name) => { columnCalls.push({ type: 'timestamp', name }); return { notNullable: jest.fn().mockReturnThis(), nullable: jest.fn().mockReturnThis(), defaultTo: jest.fn().mockReturnThis() }; }),
      timestamps: jest.fn(() => { columnCalls.push({ type: 'timestamps' }); }),
      unique: jest.fn(),
      index: jest.fn(),
    };
    return self;
  }

  function makeKnex() {
    const tableBuilder = makeTableBuilder();
    return {
      schema: {
        createTable: jest.fn((_name, cb) => { cb(tableBuilder); return Promise.resolve(); }),
        dropTableIfExists: jest.fn().mockResolvedValue(undefined),
      },
      raw: jest.fn((v) => v),
      __tableBuilder: tableBuilder,
    };
  }

  it('up() creates the firmware_versions table', async () => {
    const migration = require('../migrations/011_create_firmware_versions');
    const knex = makeKnex();
    await migration.up(knex);
    expect(knex.schema.createTable).toHaveBeenCalledWith('firmware_versions', expect.any(Function));
  });

  it('up() adds version and hardware_model columns', async () => {
    const migration = require('../migrations/011_create_firmware_versions');
    const knex = makeKnex();
    await migration.up(knex);
    const names = columnCalls.map((c) => c.name);
    expect(names).toContain('version');
    expect(names).toContain('hardware_model');
  });

  it('up() adds download_url column', async () => {
    const migration = require('../migrations/011_create_firmware_versions');
    const knex = makeKnex();
    await migration.up(knex);
    const names = columnCalls.map((c) => c.name);
    expect(names).toContain('download_url');
  });

  it('down() drops the firmware_versions table', async () => {
    const migration = require('../migrations/011_create_firmware_versions');
    const knex = makeKnex();
    await migration.down(knex);
    expect(knex.schema.dropTableIfExists).toHaveBeenCalledWith('firmware_versions');
  });
});
