'use strict';

/**
 * Unit test for migration 014_create_rules.js
 * Verifies table + column creation, indexes, FK references, RLS policy.
 */

describe('Migration 014: create_rules', () => {
  let columnCalls;

  function makeTableBuilder() {
    columnCalls = [];
    const colChain = {
      primary: jest.fn().mockReturnThis(),
      defaultTo: jest.fn().mockReturnThis(),
      notNullable: jest.fn().mockReturnThis(),
      nullable: jest.fn().mockReturnThis(),
      references: jest.fn().mockReturnThis(),
      inTable: jest.fn().mockReturnThis(),
      onDelete: jest.fn().mockReturnThis(),
    };
    return {
      uuid: jest.fn((name) => { columnCalls.push({ type: 'uuid', name }); return colChain; }),
      string: jest.fn((name) => { columnCalls.push({ type: 'string', name }); return colChain; }),
      boolean: jest.fn((name) => { columnCalls.push({ type: 'boolean', name }); return colChain; }),
      jsonb: jest.fn((name) => { columnCalls.push({ type: 'jsonb', name }); return colChain; }),
      integer: jest.fn((name) => { columnCalls.push({ type: 'integer', name }); return colChain; }),
      timestamp: jest.fn((name) => { columnCalls.push({ type: 'timestamp', name }); return colChain; }),
      timestamps: jest.fn(() => { columnCalls.push({ type: 'timestamps' }); }),
      index: jest.fn(),
    };
  }

  function makeKnex() {
    const tableBuilder = makeTableBuilder();
    return {
      schema: {
        createTable: jest.fn((_name, cb) => { cb(tableBuilder); return Promise.resolve(); }),
        dropTableIfExists: jest.fn().mockResolvedValue(undefined),
        hasTable: jest.fn().mockResolvedValue(true),
      },
      raw: jest.fn().mockResolvedValue(undefined),
      fn: { now: jest.fn(() => 'NOW()') },
      __tableBuilder: tableBuilder,
    };
  }

  it('up() creates the rules table', async () => {
    const migration = require('../migrations/014_create_rules');
    const knex = makeKnex();
    await migration.up(knex);
    expect(knex.schema.createTable).toHaveBeenCalledWith('rules', expect.any(Function));
  });

  it('up() adds uuid columns: id, tenant_id', async () => {
    const migration = require('../migrations/014_create_rules');
    const knex = makeKnex();
    await migration.up(knex);
    const uuidNames = columnCalls.filter((c) => c.type === 'uuid').map((c) => c.name);
    expect(uuidNames).toContain('id');
    expect(uuidNames).toContain('tenant_id');
  });

  it('up() adds string columns: name, description, trigger_type, action_type', async () => {
    const migration = require('../migrations/014_create_rules');
    const knex = makeKnex();
    await migration.up(knex);
    const stringNames = columnCalls.filter((c) => c.type === 'string').map((c) => c.name);
    expect(stringNames).toContain('name');
    expect(stringNames).toContain('description');
    expect(stringNames).toContain('trigger_type');
    expect(stringNames).toContain('action_type');
  });

  it('up() adds boolean column: enabled', async () => {
    const migration = require('../migrations/014_create_rules');
    const knex = makeKnex();
    await migration.up(knex);
    const booleanNames = columnCalls.filter((c) => c.type === 'boolean').map((c) => c.name);
    expect(booleanNames).toContain('enabled');
  });

  it('up() adds jsonb columns: trigger_config, action_config', async () => {
    const migration = require('../migrations/014_create_rules');
    const knex = makeKnex();
    await migration.up(knex);
    const jsonbNames = columnCalls.filter((c) => c.type === 'jsonb').map((c) => c.name);
    expect(jsonbNames).toContain('trigger_config');
    expect(jsonbNames).toContain('action_config');
  });

  it('up() adds integer column: cooldown_ms', async () => {
    const migration = require('../migrations/014_create_rules');
    const knex = makeKnex();
    await migration.up(knex);
    const intNames = columnCalls.filter((c) => c.type === 'integer').map((c) => c.name);
    expect(intNames).toContain('cooldown_ms');
  });

  it('up() adds timestamp column: last_fired_at and timestamps helper', async () => {
    const migration = require('../migrations/014_create_rules');
    const knex = makeKnex();
    await migration.up(knex);
    const tsNames = columnCalls.filter((c) => c.type === 'timestamp').map((c) => c.name);
    expect(tsNames).toContain('last_fired_at');
    expect(columnCalls).toContainEqual({ type: 'timestamps' });
  });

  it('up() creates indexes on tenant_id and (tenant_id, enabled)', async () => {
    const migration = require('../migrations/014_create_rules');
    const knex = makeKnex();
    const tb = knex.__tableBuilder;
    await migration.up(knex);
    expect(tb.index).toHaveBeenCalledWith(['tenant_id']);
    expect(tb.index).toHaveBeenCalledWith(['tenant_id', 'enabled']);
  });

  it('up() enables RLS on rules', async () => {
    const migration = require('../migrations/014_create_rules');
    const knex = makeKnex();
    await migration.up(knex);
    const rawSqls = knex.raw.mock.calls.map((c) => c[0]);
    expect(rawSqls.some((sql) => /ENABLE ROW LEVEL SECURITY/.test(sql))).toBe(true);
  });

  it('up() creates tenant_isolation policy on rules', async () => {
    const migration = require('../migrations/014_create_rules');
    const knex = makeKnex();
    await migration.up(knex);
    const rawSqls = knex.raw.mock.calls.map((c) => c[0]);
    const policy = rawSqls.find((sql) => /CREATE POLICY tenant_isolation ON rules/.test(sql));
    expect(policy).toBeDefined();
    expect(policy).toMatch(/tenant_id/);
    expect(policy).toMatch(/app\.tenant_id/);
  });

  it('down() drops policy and table', async () => {
    const migration = require('../migrations/014_create_rules');
    const knex = makeKnex();
    await migration.down(knex);
    expect(knex.schema.dropTableIfExists).toHaveBeenCalledWith('rules');
    const rawSqls = knex.raw.mock.calls.map((c) => c[0]);
    expect(rawSqls.some((sql) => /DROP POLICY IF EXISTS tenant_isolation ON rules/.test(sql))).toBe(true);
  });

  it('down() does not error when table does not exist', async () => {
    const migration = require('../migrations/014_create_rules');
    const knex = makeKnex();
    knex.schema.dropTableIfExists.mockResolvedValue(undefined);
    await expect(migration.down(knex)).resolves.toBeUndefined();
  });
});
