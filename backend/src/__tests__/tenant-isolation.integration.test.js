'use strict';

/**
 * Integration tests for multi-tenant data isolation.
 *
 * These tests verify that Tenant A's data is NOT accessible from Tenant B's
 * context — the fundamental guarantee of the iotech multi-tenancy model.
 *
 * Requires a real PostgreSQL database.
 * How to run:
 *   DATABASE_URL=postgres://... TEST_INTEGRATION=true npx jest tenant-isolation
 */

const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

// ─── Conditional skip guard ───────────────────────────────────────────────────
const canRunIntegration =
  process.env.DATABASE_URL && process.env.TEST_INTEGRATION === 'true';

(canRunIntegration ? describe : describe.skip)('Multi-Tenant Isolation', () => {
  let app;
  let db;

  // Tenant A
  let tenantAId;
  let tokenA; // access token for tenant A user

  // Tenant B
  let tenantBId;
  let tokenB; // access token for tenant B user

  // Device created in Tenant A
  let deviceAId;

  // ─── Setup ───────────────────────────────────────────────────────────────

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'isolation-test-secret';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET || 'isolation-test-refresh-secret';
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';

    const createApp = require('../app');
    db = require('../shared/db/knex');
    app = createApp();

    // ── Create Tenant A ────────────────────────────────────────────────────
    tenantAId = uuidv4();
    await db('tenants').insert({ id: tenantAId, name: `Tenant A – ${tenantAId.slice(0, 8)}` });

    // Register + login user for Tenant A
    const emailA = `user-a-${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .send({ tenantId: tenantAId, email: emailA, password: 'TenantAPass99!' });

    const loginA = await request(app)
      .post('/api/auth/login')
      .send({ tenantId: tenantAId, email: emailA, password: 'TenantAPass99!' });

    tokenA = loginA.body.accessToken;

    // ── Create Tenant B ────────────────────────────────────────────────────
    tenantBId = uuidv4();
    await db('tenants').insert({ id: tenantBId, name: `Tenant B – ${tenantBId.slice(0, 8)}` });

    // Register + login user for Tenant B
    const emailB = `user-b-${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .send({ tenantId: tenantBId, email: emailB, password: 'TenantBPass99!' });

    const loginB = await request(app)
      .post('/api/auth/login')
      .send({ tenantId: tenantBId, email: emailB, password: 'TenantBPass99!' });

    tokenB = loginB.body.accessToken;

    // ── Create a device in Tenant A ────────────────────────────────────────
    const createDevRes = await request(app)
      .post('/api/devices')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Tenant A — Exclusive Sensor' });

    expect(createDevRes.status).toBe(201);
    deviceAId = createDevRes.body.data.id;
  });

  afterAll(async () => {
    if (db) {
      // Remove telemetry for both tenants
      await db('telemetry').whereIn('tenant_id', [tenantAId, tenantBId]).delete();

      // Remove devices for both tenants
      await db('devices').whereIn('tenant_id', [tenantAId, tenantBId]).delete();

      // Remove refresh_tokens and users for both tenants
      const userIds = await db('users')
        .whereIn('tenant_id', [tenantAId, tenantBId])
        .pluck('id');

      if (userIds.length) {
        await db('refresh_tokens').whereIn('user_id', userIds).delete();
      }
      await db('users').whereIn('tenant_id', [tenantAId, tenantBId]).delete();

      await db('tenants').whereIn('id', [tenantAId, tenantBId]).delete();

      await db.destroy();
    }
  });

  // ─── Device isolation ────────────────────────────────────────────────────

  describe('Device cross-tenant isolation', () => {
    it('Tenant A can list its own device', async () => {
      const res = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((d) => d.id);
      expect(ids).toContain(deviceAId);
    });

    it('Tenant B cannot see Tenant A devices in list', async () => {
      const res = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((d) => d.id);
      // Tenant B's list must NOT contain Tenant A's device
      expect(ids).not.toContain(deviceAId);
    });

    it('Tenant B gets 404 when directly requesting Tenant A device by ID', async () => {
      const res = await request(app)
        .get(`/api/devices/${deviceAId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });

    it('Tenant B cannot update Tenant A device', async () => {
      const res = await request(app)
        .put(`/api/devices/${deviceAId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Hacked by Tenant B' });

      // Should be 404 (device not found in tenant B's scope) or 403
      expect([403, 404]).toContain(res.status);
    });

    it('Tenant B cannot delete Tenant A device', async () => {
      const res = await request(app)
        .delete(`/api/devices/${deviceAId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      // Should be 404 (not found in tenant B) or 403
      expect([403, 404]).toContain(res.status);

      // Verify device still exists (was NOT deleted)
      const check = await db('devices').where({ id: deviceAId }).first();
      expect(check).toBeDefined();
    });
  });

  // ─── Telemetry isolation ─────────────────────────────────────────────────

  describe('Telemetry cross-tenant isolation', () => {
    it('Tenant B gets 404 when querying telemetry for Tenant A device', async () => {
      const res = await request(app)
        .get(`/api/telemetry/devices/${deviceAId}/telemetry`)
        .set('Authorization', `Bearer ${tokenB}`);

      // telemetry.service.query() checks device belongs to tenant → NotFoundError
      expect(res.status).toBe(404);
    });

    it('Tenant A can query telemetry for its own device (even if empty)', async () => {
      const res = await request(app)
        .get(`/api/telemetry/devices/${deviceAId}/telemetry`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
