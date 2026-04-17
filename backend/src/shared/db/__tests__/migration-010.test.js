'use strict';

/**
 * Unit test for migration 010_add_claim_fields_to_devices.js
 * Verifies that the migration adds the expected columns via Knex schema calls.
 *
 * RED → verify the migration file does not yet exist (will fail to require),
 * then implement and go GREEN.
 */

describe('Migration 010: add_claim_fields_to_devices', () => {
  let addColumnCalls;
  let indexCalls;

  beforeEach(() => {
    addColumnCalls = [];
    indexCalls = [];
  });

  /**
   * Builds a mock Knex `table` builder that records column additions.
   */
  function makeTableBuilder() {
    const chainable = { nullable: jest.fn().mockReturnThis(), unique: jest.fn().mockReturnThis(), notNullable: jest.fn().mockReturnThis(), defaultTo: jest.fn().mockReturnThis(), alter: jest.fn().mockReturnThis() };
    return {
      string: jest.fn((name, len) => { addColumnCalls.push({ type: 'string', name, len }); return chainable; }),
      timestamp: jest.fn((name) => { addColumnCalls.push({ type: 'timestamp', name }); return chainable; }),
      index: jest.fn((cols) => { indexCalls.push(cols); }),
    };
  }

  function makeKnex() {
    const tableBuilder = makeTableBuilder();
    return {
      schema: {
        table: jest.fn((tableName, cb) => {
          cb(tableBuilder);
          return Promise.resolve();
        }),
        dropColumn: jest.fn().mockResolvedValue(undefined),
      },
      __tableBuilder: tableBuilder,
    };
  }

  it('up() calls schema.table on the devices table', async () => {
    const migration = require('../migrations/010_add_claim_fields_to_devices');
    const knex = makeKnex();
    await migration.up(knex);
    expect(knex.schema.table).toHaveBeenCalledWith('devices', expect.any(Function));
  });

  it('up() adds claim_token as a nullable string column', async () => {
    const migration = require('../migrations/010_add_claim_fields_to_devices');
    const knex = makeKnex();
    await migration.up(knex);
    const claimTokenCall = addColumnCalls.find((c) => c.name === 'claim_token');
    expect(claimTokenCall).toBeDefined();
    expect(claimTokenCall.type).toBe('string');
  });

  it('up() adds claimed_at as a nullable timestamp column', async () => {
    const migration = require('../migrations/010_add_claim_fields_to_devices');
    const knex = makeKnex();
    await migration.up(knex);
    const claimedAtCall = addColumnCalls.find((c) => c.name === 'claimed_at');
    expect(claimedAtCall).toBeDefined();
    expect(claimedAtCall.type).toBe('timestamp');
  });

  it('up() adds hardware_id as a nullable string column (max 100 chars)', async () => {
    const migration = require('../migrations/010_add_claim_fields_to_devices');
    const knex = makeKnex();
    await migration.up(knex);
    const hwIdCall = addColumnCalls.find((c) => c.name === 'hardware_id');
    expect(hwIdCall).toBeDefined();
    expect(hwIdCall.type).toBe('string');
    expect(hwIdCall.len).toBe(100);
  });

  it('down() calls schema.table to drop the added columns', async () => {
    const migration = require('../migrations/010_add_claim_fields_to_devices');
    const chainable = { nullable: jest.fn().mockReturnThis(), notNullable: jest.fn().mockReturnThis(), defaultTo: jest.fn().mockReturnThis(), alter: jest.fn().mockReturnThis() };
    const downKnex = {
      schema: {
        table: jest.fn((_t, cb) => {
          const tbl = { dropColumn: jest.fn(), string: jest.fn(() => chainable) };
          cb(tbl);
          return Promise.resolve();
        }),
      },
    };
    await migration.down(downKnex);
    expect(downKnex.schema.table).toHaveBeenCalledWith('devices', expect.any(Function));
  });
});
