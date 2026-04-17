'use strict';

/**
 * Unit test for migration 012_create_dashboards.js
 * Verifies table + column creation, JSONB layout default, FK, RLS raw calls.
 */

describe('Migration 012: create_dashboards', () => {
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
      text: jest.fn((name) => { columnCalls.push({ type: 'text', name }); return colChain; }),
      jsonb: jest.fn((name) => { columnCalls.push({ type: 'jsonb', name }); return colChain; }),
      timestamp: jest.fn((name) => { columnCalls.push({ type: 'timestamp', name }); return colChain; }),
      timestamps: jest.fn(() => { columnCalls.push({ type: 'timestamps' }); }),
      unique: jest.fn(),
      index: jest.fn(),
    };
  }

  function makeKnex() {
    const tableBuilder = makeTableBuilder();
    const rawCalls = [];
    return {
      schema: {
        createTable: jest.fn((_name, cb) => { cb(tableBuilder); return Promise.resolve(); }),
        dropTableIfExists: jest.fn().mockResolvedValue(undefined),
      },
      raw: jest.fn((sql) => { rawCalls.push(sql); return Promise.resolve(); }),
      __tableBuilder: tableBuilder,
      __rawCalls: rawCalls,
    };
  }

  it('up() creates the dashboards table', async () => {
    const migration = require('../migrations/012_create_dashboards');
    const knex = makeKnex();
    await migration.up(knex);
    expect(knex.schema.createTable).toHaveBeenCalledWith('dashboards', expect.any(Function));
  });

  it('up() adds required columns: id, name, description, layout, installer_id', async () => {
    const migration = require('../migrations/012_create_dashboards');
    const knex = makeKnex();
    await migration.up(knex);
    const names = columnCalls.map((c) => c.name);
    expect(names).toContain('id');
    expect(names).toContain('name');
    expect(names).toContain('description');
    expect(names).toContain('layout');
    expect(names).toContain('installer_id');
  });

  it('up() layout column has type jsonb', async () => {
    const migration = require('../migrations/012_create_dashboards');
    const knex = makeKnex();
    await migration.up(knex);
    const layoutCol = columnCalls.find((c) => c.name === 'layout');
    expect(layoutCol).toBeDefined();
    expect(layoutCol.type).toBe('jsonb');
  });

  it('up() adds timestamps columns', async () => {
    const migration = require('../migrations/012_create_dashboards');
    const knex = makeKnex();
    await migration.up(knex);
    const hasTimestamps = columnCalls.some((c) => c.type === 'timestamps');
    expect(hasTimestamps).toBe(true);
  });

  it('up() enables RLS on dashboards', async () => {
    const migration = require('../migrations/012_create_dashboards');
    const knex = makeKnex();
    await migration.up(knex);
    const rawSqls = knex.raw.mock.calls.map((c) => c[0]);
    const hasEnableRls = rawSqls.some((sql) => /ENABLE ROW LEVEL SECURITY/.test(sql));
    expect(hasEnableRls).toBe(true);
  });

  it('up() creates tenant_isolation policy on dashboards', async () => {
    const migration = require('../migrations/012_create_dashboards');
    const knex = makeKnex();
    await migration.up(knex);
    const rawSqls = knex.raw.mock.calls.map((c) => c[0]);
    const hasPolicy = rawSqls.some((sql) => /CREATE POLICY tenant_isolation ON dashboards/.test(sql));
    expect(hasPolicy).toBe(true);
  });

  it('up() policy uses installer_id = app.tenant_id', async () => {
    const migration = require('../migrations/012_create_dashboards');
    const knex = makeKnex();
    await migration.up(knex);
    const rawSqls = knex.raw.mock.calls.map((c) => c[0]);
    const policySQL = rawSqls.find((sql) => /CREATE POLICY tenant_isolation ON dashboards/.test(sql));
    expect(policySQL).toMatch(/installer_id/);
    expect(policySQL).toMatch(/app\.tenant_id/);
  });

  it('down() drops the tenant_isolation policy and dashboards table', async () => {
    const migration = require('../migrations/012_create_dashboards');
    const knex = makeKnex();
    await migration.down(knex);
    expect(knex.schema.dropTableIfExists).toHaveBeenCalledWith('dashboards');
    const rawSqls = knex.raw.mock.calls.map((c) => c[0]);
    expect(rawSqls.some((sql) => /DROP POLICY IF EXISTS tenant_isolation ON dashboards/.test(sql))).toBe(true);
  });
});
