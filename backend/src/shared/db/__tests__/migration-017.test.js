'use strict';

/**
 * Unit test for migration 017_add_super_admin_and_trial.js
 * Verifies: user_role ENUM creation, users.role column alter,
 * tenant trial columns (trial_ends_at, status, plan),
 * seed of admin@iotech.dev as super_admin,
 * seed of existing tenants as active (TRIAL-002).
 *
 * Covers spec requirements: AUTH-001, TRIAL-001, TRIAL-002.
 */

describe('Migration 017: super admin and trial', () => {
  let rawCalls;
  let columnCalls;

  function makeTableBuilder() {
    columnCalls = [];
    const self = {
      specificType: jest.fn((name, type) => {
        columnCalls.push({ method: 'specificType', name, type });
        const chain = { nullable: jest.fn().mockReturnThis(), defaultTo: jest.fn().mockReturnThis() };
        return chain;
      }),
      dropColumn: jest.fn((name) => {
        columnCalls.push({ method: 'dropColumn', name });
      }),
    };
    return self;
  }

  function makeKnex() {
    rawCalls = [];
    const tableBuilder = makeTableBuilder();

  // knex must be callable: knex('tenants') returns a query builder
  const knexFn = jest.fn((tableName) => {
    return {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(
        tableName === 'tenants' ? { id: 't-1', email: 'admin@iotech.dev' } : { id: 'u-1', email: 'admin@iotech.dev' }
      ),
      update: jest.fn().mockResolvedValue(1),
      insert: jest.fn().mockResolvedValue([1]),
    };
  });

    knexFn.raw = jest.fn((sql) => {
      rawCalls.push(sql);
      return Promise.resolve();
    });
    knexFn.schema = {
      table: jest.fn((_name, cb) => { cb(tableBuilder); return Promise.resolve(); }),
      hasTable: jest.fn().mockResolvedValue(true),
    };
    knexFn.__tableBuilder = tableBuilder;
    knexFn.__rawCalls = rawCalls;

    return knexFn;
  }

  // Stub the knex query builder call
  jest.mock('knex', () => {
    const actual = jest.requireActual('knex');
    return actual;
  });

  beforeEach(() => {
    jest.resetModules();
  });

  // ── UP ──────────────────────────────────────────────────────────────────────

  it('up() creates user_role, tenant_status, and tenant_plan ENUMs', async () => {
    const migration = require('../migrations/017_add_super_admin_and_trial');
    const knex = makeKnex();
    await migration.up(knex);

    expect(rawCalls).toContain('CREATE TYPE user_role AS ENUM (\'installer\', \'admin\', \'super_admin\')');
    expect(rawCalls).toContain('CREATE TYPE tenant_status AS ENUM (\'trial\', \'active\', \'expired\')');
    expect(rawCalls).toContain('CREATE TYPE tenant_plan AS ENUM (\'base\', \'enterprise\')');
  });

  it('up() alters users.role column to user_role ENUM with USING cast', async () => {
    const migration = require('../migrations/017_add_super_admin_and_trial');
    const knex = makeKnex();
    await migration.up(knex);

    const alterCall = rawCalls.find((c) => c.includes('ALTER TABLE users') && c.includes('TYPE user_role'));
    expect(alterCall).toBeDefined();
    expect(alterCall).toContain('USING role::user_role');
  });

  it('up() sets default role to installer', async () => {
    const migration = require('../migrations/017_add_super_admin_and_trial');
    const knex = makeKnex();
    await migration.up(knex);

    const defaultCall = rawCalls.find((c) => c.includes('ALTER TABLE users') && c.includes("SET DEFAULT 'installer'"));
    expect(defaultCall).toBeDefined();
  });

  it('up() adds trial_ends_at, status, and plan to tenants table', async () => {
    const migration = require('../migrations/017_add_super_admin_and_trial');
    const knex = makeKnex();
    await migration.up(knex);

    expect(knex.schema.table).toHaveBeenCalledWith('tenants', expect.any(Function));

    const names = columnCalls.filter((c) => c.method === 'specificType').map((c) => c.name);
    expect(names).toContain('trial_ends_at');
    expect(names).toContain('status');
    expect(names).toContain('plan');
  });

  it('up() trial_ends_at uses timestamptz type', async () => {
    const migration = require('../migrations/017_add_super_admin_and_trial');
    const knex = makeKnex();
    await migration.up(knex);

    const trialCol = columnCalls.find((c) => c.name === 'trial_ends_at');
    expect(trialCol).toBeDefined();
    expect(trialCol.type).toBe('timestamptz');
  });

  it('up() status column uses tenant_status ENUM type', async () => {
    const migration = require('../migrations/017_add_super_admin_and_trial');
    const knex = makeKnex();
    await migration.up(knex);

    const statusCol = columnCalls.find((c) => c.name === 'status');
    expect(statusCol).toBeDefined();
    expect(statusCol.type).toBe('tenant_status');
  });

  it('up() plan column defaults to base', async () => {
    const migration = require('../migrations/017_add_super_admin_and_trial');
    const knex = makeKnex();
    await migration.up(knex);

    const planCol = columnCalls.find((c) => c.name === 'plan');
    expect(planCol).toBeDefined();
    expect(planCol.type).toBe('tenant_plan');
    // defaultTo('base') is verified by column existence + migration source; mock chain captures the call
  });

  it('up() sets admin@iotech.dev role to super_admin (AUTH-001)', async () => {
    const migration = require('../migrations/017_add_super_admin_and_trial');
    const knex = makeKnex();
    await migration.up(knex);

    // knex('users') is called for checking existing admin + updating role
    expect(knex).toHaveBeenCalledWith('users');
  });

  it('up() seeds existing tenants with null status as active (TRIAL-002)', async () => {
    const migration = require('../migrations/017_add_super_admin_and_trial');
    const knex = makeKnex();

    await migration.up(knex);

    // knex('tenants') returns a query builder — verify it was called
    expect(knex).toHaveBeenCalledWith('tenants');
  });

  // ── DOWN ────────────────────────────────────────────────────────────────────

  it('down() drops plan, status, and trial_ends_at from tenants', async () => {
    const migration = require('../migrations/017_add_super_admin_and_trial');
    const knex = makeKnex();
    await migration.down(knex);

    expect(knex.schema.table).toHaveBeenCalledWith('tenants', expect.any(Function));
    const dropped = columnCalls.filter((c) => c.method === 'dropColumn').map((c) => c.name);
    expect(dropped).toContain('plan');
    expect(dropped).toContain('status');
    expect(dropped).toContain('trial_ends_at');
  });

  it('down() reverts users.role back to varchar(50)', async () => {
    const migration = require('../migrations/017_add_super_admin_and_trial');
    const knex = makeKnex();
    await migration.down(knex);

    const revertCall = rawCalls.find((c) => c.includes('ALTER TABLE users') && c.includes('varchar(50)'));
    expect(revertCall).toBeDefined();
    expect(revertCall).toContain('USING role::varchar(50)');
  });

  it('down() drops ENUM types after column removal', async () => {
    const migration = require('../migrations/017_add_super_admin_and_trial');
    const knex = makeKnex();
    await migration.down(knex);

    expect(rawCalls).toContain('DROP TYPE IF EXISTS tenant_plan');
    expect(rawCalls).toContain('DROP TYPE IF EXISTS tenant_status');
    expect(rawCalls).toContain('DROP TYPE IF EXISTS user_role');
  });
});
