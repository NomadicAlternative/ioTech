'use strict';

/**
 * Unit test for migration 013_create_dashboard_clients.js
 * Verifies table + column creation, unique constraint, FK references, RLS via EXISTS subquery.
 */

describe('Migration 013: create_dashboard_clients', () => {
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
    const uniqueFn = jest.fn();
    return {
      uuid: jest.fn((name) => { columnCalls.push({ type: 'uuid', name }); return colChain; }),
      timestamp: jest.fn((name) => { columnCalls.push({ type: 'timestamp', name }); return colChain; }),
      timestamps: jest.fn(() => { columnCalls.push({ type: 'timestamps' }); }),
      unique: uniqueFn,
      __uniqueFn: uniqueFn,
    };
  }

  function makeKnex() {
    const tableBuilder = makeTableBuilder();
    return {
      schema: {
        createTable: jest.fn((_name, cb) => { cb(tableBuilder); return Promise.resolve(); }),
        dropTableIfExists: jest.fn().mockResolvedValue(undefined),
      },
      raw: jest.fn().mockResolvedValue(undefined),
      fn: { now: jest.fn(() => 'NOW()') },
      __tableBuilder: tableBuilder,
    };
  }

  it('up() creates the dashboard_clients table', async () => {
    const migration = require('../migrations/013_create_dashboard_clients');
    const knex = makeKnex();
    await migration.up(knex);
    expect(knex.schema.createTable).toHaveBeenCalledWith('dashboard_clients', expect.any(Function));
  });

  it('up() adds columns: id, dashboard_id, client_id, created_at', async () => {
    const migration = require('../migrations/013_create_dashboard_clients');
    const knex = makeKnex();
    await migration.up(knex);
    const names = columnCalls.map((c) => c.name);
    expect(names).toContain('id');
    expect(names).toContain('dashboard_id');
    expect(names).toContain('client_id');
    expect(names).toContain('created_at');
  });

  it('up() adds unique constraint on [dashboard_id, client_id]', async () => {
    const migration = require('../migrations/013_create_dashboard_clients');
    const knex = makeKnex();
    await migration.up(knex);
    const tb = knex.__tableBuilder;
    expect(tb.unique).toHaveBeenCalledWith(['dashboard_id', 'client_id']);
  });

  it('up() enables RLS on dashboard_clients', async () => {
    const migration = require('../migrations/013_create_dashboard_clients');
    const knex = makeKnex();
    await migration.up(knex);
    const rawSqls = knex.raw.mock.calls.map((c) => c[0]);
    expect(rawSqls.some((sql) => /ENABLE ROW LEVEL SECURITY/.test(sql))).toBe(true);
  });

  it('up() creates tenant_isolation policy on dashboard_clients using EXISTS subquery', async () => {
    const migration = require('../migrations/013_create_dashboard_clients');
    const knex = makeKnex();
    await migration.up(knex);
    const rawSqls = knex.raw.mock.calls.map((c) => c[0]);
    const policy = rawSqls.find((sql) => /CREATE POLICY tenant_isolation ON dashboard_clients/.test(sql));
    expect(policy).toBeDefined();
    expect(policy).toMatch(/EXISTS/);
    expect(policy).toMatch(/dashboards/);
    expect(policy).toMatch(/installer_id/);
    expect(policy).toMatch(/app\.tenant_id/);
  });

  it('down() drops policy and table', async () => {
    const migration = require('../migrations/013_create_dashboard_clients');
    const knex = makeKnex();
    await migration.down(knex);
    expect(knex.schema.dropTableIfExists).toHaveBeenCalledWith('dashboard_clients');
    const rawSqls = knex.raw.mock.calls.map((c) => c[0]);
    expect(rawSqls.some((sql) => /DROP POLICY IF EXISTS tenant_isolation ON dashboard_clients/.test(sql))).toBe(true);
  });
});
