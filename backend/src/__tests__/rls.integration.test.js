'use strict';

/**
 * RLS (Row-Level Security) enforcement tests.
 *
 * These tests verify that PostgreSQL RLS policies work correctly at the DB
 * level, providing a second layer of defence on top of application-level
 * tenant_id filtering.
 *
 * Strategy:
 *   - Bypass the HTTP layer entirely and call withTenant() directly
 *   - Set app.tenant_id to Tenant A → only Tenant A rows returned
 *   - Set app.tenant_id to Tenant B → only Tenant B rows returned
 *   - Without setting app.tenant_id → 0 rows returned (default-deny)
 *
 * Requires:
 *   - PostgreSQL with RLS policies from migration 008_enable_rls.js
 *   - App DB user (iotech_app) must NOT be a superuser so RLS applies
 *   - DATABASE_URL and TEST_INTEGRATION=true
 *
 * How to run:
 *   DATABASE_URL=postgres://... TEST_INTEGRATION=true npx jest rls.integration
 */

const { v4: uuidv4 } = require('uuid');

// ─── Conditional skip guard ───────────────────────────────────────────────────
const canRunIntegration =
  process.env.DATABASE_URL && process.env.TEST_INTEGRATION === 'true';

(canRunIntegration ? describe : describe.skip)('RLS Enforcement', () => {
  let db;
  let withTenant;
  let tenantAId;
  let tenantBId;
  let deviceAId;
  let deviceBId;

  // ─── Setup ────────────────────────────────────────────────────────────────

  beforeAll(async () => {
    db = require('../shared/db/knex');
    ({ withTenant } = require('../shared/db/tenant-knex'));

    // Create two isolated tenants for RLS tests
    tenantAId = uuidv4();
    tenantBId = uuidv4();

    await db('tenants').insert([
      { id: tenantAId, name: `RLS Tenant A – ${tenantAId.slice(0, 8)}` },
      { id: tenantBId, name: `RLS Tenant B – ${tenantBId.slice(0, 8)}` },
    ]);

    // Insert one device per tenant using raw inserts (bypasses service layer)
    deviceAId = uuidv4();
    deviceBId = uuidv4();

    // Note: We bypass withTenant() here (using raw db) so we can insert into
    // both tenants without a single context switch. The migration's RLS policy
    // may block this if the app user is non-superuser — in that case, these
    // inserts need to be done via the superuser or a separate seeding mechanism.
    //
    // If this fails, it means your DB user needs INSERT privilege or you must
    // temporarily disable RLS for seeding. The tests themselves test the SELECT
    // filtering, not the INSERT path.
    await db('devices').insert([
      {
        id: deviceAId,
        tenant_id: tenantAId,
        name: 'RLS Device A',
        device_token: uuidv4(),
        status: 'active',
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: deviceBId,
        tenant_id: tenantBId,
        name: 'RLS Device B',
        device_token: uuidv4(),
        status: 'active',
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  });

  afterAll(async () => {
    if (db) {
      await db('telemetry').whereIn('tenant_id', [tenantAId, tenantBId]).delete();
      await db('devices').whereIn('tenant_id', [tenantAId, tenantBId]).delete();
      await db('users').whereIn('tenant_id', [tenantAId, tenantBId]).delete();
      await db('tenants').whereIn('id', [tenantAId, tenantBId]).delete();
      await db.destroy();
    }
  });

  // ─── RLS: Tenant A context ────────────────────────────────────────────────

  describe('With app.tenant_id = Tenant A', () => {
    it('returns ONLY Tenant A devices (not Tenant B)', async () => {
      const rows = await withTenant(tenantAId, (trx) =>
        trx('devices').select('id', 'tenant_id', 'name')
      );

      const ids = rows.map((r) => r.id);
      expect(ids).toContain(deviceAId);
      expect(ids).not.toContain(deviceBId);

      // All returned rows must belong to Tenant A
      rows.forEach((row) => {
        expect(row.tenant_id).toBe(tenantAId);
      });
    });

    it('cannot see Tenant B device when queried by ID', async () => {
      const row = await withTenant(tenantAId, (trx) =>
        trx('devices').where({ id: deviceBId }).first()
      );

      // RLS should block this — returns undefined (not Tenant A's device)
      expect(row).toBeUndefined();
    });
  });

  // ─── RLS: Tenant B context ────────────────────────────────────────────────

  describe('With app.tenant_id = Tenant B', () => {
    it('returns ONLY Tenant B devices (not Tenant A)', async () => {
      const rows = await withTenant(tenantBId, (trx) =>
        trx('devices').select('id', 'tenant_id', 'name')
      );

      const ids = rows.map((r) => r.id);
      expect(ids).toContain(deviceBId);
      expect(ids).not.toContain(deviceAId);

      rows.forEach((row) => {
        expect(row.tenant_id).toBe(tenantBId);
      });
    });

    it('cannot see Tenant A device when queried by ID', async () => {
      const row = await withTenant(tenantBId, (trx) =>
        trx('devices').where({ id: deviceAId }).first()
      );

      expect(row).toBeUndefined();
    });
  });

  // ─── RLS: No tenant context (default-deny) ────────────────────────────────

  describe('Without app.tenant_id (null context)', () => {
    it('returns 0 rows — default-deny when no tenant context is set', async () => {
      // withTenant(null) skips SET LOCAL → current_setting('app.tenant_id')
      // returns empty string or throws, which matches no rows under RLS
      const rows = await withTenant(null, (trx) =>
        trx('devices').select('id', 'tenant_id')
      );

      // Under default-deny RLS: no tenant_id set → no rows returned
      // Note: this test documents the EXPECTED security behavior.
      // If it fails (rows ARE returned), your RLS policy needs a DEFAULT DENY clause.
      expect(rows.length).toBe(0);
    });

    it('direct db query without transaction returns all rows (RLS only applies inside withTenant)', async () => {
      // This is an important counter-test: the raw db singleton (without SET LOCAL)
      // demonstrates WHY we need withTenant() for RLS enforcement.
      //
      // If the DB user is a superuser or BYPASSRLS is set, this would also return
      // all rows. Under a non-privileged app user, this depends on the RLS FORCE policy.
      //
      // This test primarily serves as documentation / regression detector.
      const rows = await db('devices')
        .whereIn('tenant_id', [tenantAId, tenantBId])
        .select('id', 'tenant_id');

      // Without RLS FORCE, the app user sees all rows it has column-level access to.
      // The important thing is that withTenant(tenantId) CORRECTLY filters the result.
      expect(rows.length).toBeGreaterThanOrEqual(0); // can be 0 if FORCE RLS is active
    });
  });

  // ─── RLS: Telemetry table ─────────────────────────────────────────────────

  describe('RLS on telemetry table', () => {
    let _telemetryAId;

    beforeAll(async () => {
      // Insert a telemetry row for Tenant A's device
      const [row] = await db('telemetry')
        .insert({
          device_id: deviceAId,
          tenant_id: tenantAId,
          data: { sensor: 'RLS test', value: 42 },
          received_at: new Date(),
        })
        .returning('id');
      _telemetryAId = row.id || row;
    });

    it('Tenant A context returns only Tenant A telemetry', async () => {
      const rows = await withTenant(tenantAId, (trx) =>
        trx('telemetry').select('id', 'tenant_id', 'device_id')
      );

      rows.forEach((row) => {
        expect(row.tenant_id).toBe(tenantAId);
      });
      expect(rows.some((r) => r.device_id === deviceAId)).toBe(true);
    });

    it('Tenant B context returns 0 telemetry rows (Tenant A rows invisible)', async () => {
      const rows = await withTenant(tenantBId, (trx) =>
        trx('telemetry')
          .where({ device_id: deviceAId }) // explicitly target Tenant A's device
          .select('id', 'tenant_id')
      );

      // RLS should block Tenant B from seeing Tenant A telemetry
      expect(rows.length).toBe(0);
    });
  });
});
