'use strict';

/**
 * Integration tests for Admin endpoints.
 *
 * Requires a real PostgreSQL database with schema migrated.
 * Conditionally skipped unless TEST_INTEGRATION=true and DATABASE_URL is set.
 *
 * How to run:
 *   DATABASE_URL=postgres://... TEST_INTEGRATION=true npx jest admin.integration
 */

const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

// ─── Conditional skip guard ───────────────────────────────────────────────────
const canRunIntegration =
  process.env.DATABASE_URL && process.env.TEST_INTEGRATION === 'true';

(canRunIntegration ? describe : describe.skip)('Admin Integration', () => {
  let app;
  let db;
  let saToken;         // super admin JWT
  let installerToken;  // regular installer JWT
  let testTenantId;    // tenant for in-tenant user
  let installerTenantId; // tenant created via installer-register
  let installerUserId;

  // ─── Setup ─────────────────────────────────────────────────────────────────

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET || 'integration-test-refresh-secret';
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';
    process.env.SUPER_ADMIN_EMAILS =
      process.env.SUPER_ADMIN_EMAILS || 'super@admin.com';

    const createApp = require('../app');
    db = require('../shared/db/knex');
    app = createApp();

    // ── Seed: super admin tenant + user ──────────────────────────────────────
    const saTenantId = uuidv4();
    await db('tenants').insert({
      id: saTenantId,
      name: 'SA Tenant',
      email: 'sa-tenant@example.com',
      status: 'active',
    });

    // Insert super admin user directly (role = super_admin)
    await db('users').insert({
      id: uuidv4(),
      tenant_id: saTenantId,
      email: 'super@admin.com',
      password_hash: '$2b$12$placeholder',
      role: 'super_admin',
    });

    // ── Seed: regular tenant + installer user ────────────────────────────────
    testTenantId = uuidv4();
    await db('tenants').insert({
      id: testTenantId,
      name: 'Regular Tenant',
      email: 'regular@tenant.com',
      status: 'active',
    });

    // Login as super admin to get SA token
    const saLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ tenantId: saTenantId, email: 'super@admin.com', password: 'irrelevant' });

    // The login might fail because we don't know the password hash.
    // Instead, generate a JWT directly for the super admin.
    const jwt = require('jsonwebtoken');
    saToken = jwt.sign(
      {
        userId: uuidv4(),
        tenantId: saTenantId,
        email: 'super@admin.com',
        role: 'super_admin',
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
  });

  afterAll(async () => {
    if (db) {
      // Cleanup all test tenants
      const tenantIds = [testTenantId, installerTenantId].filter(Boolean);
      for (const tid of tenantIds) {
        await db('refresh_tokens')
          .whereIn('user_id', db('users').where({ tenant_id: tid }).select('id'))
          .delete();
        await db('users').where({ tenant_id: tid }).delete();
        await db('devices').where({ tenant_id: tid }).delete();
      }
      await db('tenants').whereIn('id', tenantIds).delete();

      // Also clean the SA tenant
      await db('tenants').where({ email: 'sa-tenant@example.com' }).delete();
      await db.destroy();
    }
  });

  // ─── 4.3: GET /api/admin/dashboard — KPI counts ─────────────────────────

  describe('4.3 GET /api/admin/dashboard', () => {
    const seededTenantIds = [];

    beforeAll(async () => {
      // Seed 3 tenants with devices and users
      for (let i = 0; i < 3; i++) {
        const tid = uuidv4();
        seededTenantIds.push(tid);
        await db('tenants').insert({
          id: tid,
          name: `Dashboard Tenant ${i}`,
          email: `dash-${i}@example.com`,
          status: 'active',
        });

        // 2 devices per tenant (1 active, 1 inactive)
        await db('devices').insert({ id: uuidv4(), tenant_id: tid, name: `Device ${i}-1`, is_active: true });
        await db('devices').insert({ id: uuidv4(), tenant_id: tid, name: `Device ${i}-2`, is_active: false });

        // 1 user per tenant
        await db('users').insert({
          id: uuidv4(),
          tenant_id: tid,
          email: `user-${i}@example.com`,
          password_hash: '$2b$12$placeholder',
          role: 'admin',
        });
      }
    });

    afterAll(async () => {
      for (const tid of seededTenantIds) {
        await db('users').where({ tenant_id: tid }).delete();
        await db('devices').where({ tenant_id: tid }).delete();
        await db('tenants').where({ id: tid }).delete();
      }
    });

    it('returns cross-tenant KPI counts', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${saToken}`);

      // The dashboard counts include our seeded data PLUS any other data.
      // We only know the minimums from what we seeded.
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.totalTenants).toBeGreaterThanOrEqual(3);
      expect(res.body.data.totalDevices).toBeGreaterThanOrEqual(6);
      expect(res.body.data.activeDevices).toBeGreaterThanOrEqual(3);
      expect(res.body.data.totalUsers).toBeGreaterThanOrEqual(3);
      expect(res.body.data).toEqual({
        totalTenants: expect.any(Number),
        totalDevices: expect.any(Number),
        activeDevices: expect.any(Number),
        totalUsers: expect.any(Number),
      });
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/admin/dashboard');
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-super-admin token', async () => {
      // Generate a token with installer role
      const jwt = require('jsonwebtoken');
      const installerJwt = jwt.sign(
        { userId: uuidv4(), tenantId: uuidv4(), email: 'inst@test.com', role: 'installer' },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${installerJwt}`);

      expect(res.status).toBe(403);
    });
  });

  // ─── 4.4: installerRegister — trial fields asserted ─────────────────────

  describe('4.4 POST /api/auth/installer-register — trial fields', () => {
    const email = `trial-test-${Date.now()}@example.com`;
    const password = 'TrialPass1234!';
    const name = 'Trial Installer';

    it('sets trial_ends_at and status=trial on new registration', async () => {
      const res = await request(app)
        .post('/api/auth/installer-register')
        .send({ name, email, password });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('tenant');
      expect(res.body).toHaveProperty('user');

      // Verify the tenant has trial fields
      installerTenantId = res.body.tenant.id;
      installerUserId = res.body.user.id;

      const tenant = await db('tenants').where({ id: installerTenantId }).first();
      expect(tenant).toBeDefined();
      expect(tenant.status).toBe('trial');
      expect(tenant.plan).toBe('base');
      expect(tenant.trial_ends_at).toBeDefined();
      expect(new Date(tenant.trial_ends_at).getTime()).toBeGreaterThan(Date.now());
    });
  });

  // ─── 4.5: Admin createTenant — trial auto-grant asserted ────────────────

  describe('4.5 POST /api/admin/tenants — trial auto-grant', () => {
    const email = `admin-create-trial-${Date.now()}@example.com`;
    const password = 'AdminPass1234!';
    const name = 'Admin Created Tenant';

    it('auto-grants trial when super admin creates a tenant', async () => {
      const res = await request(app)
        .post('/api/admin/tenants')
        .set('Authorization', `Bearer ${saToken}`)
        .send({ name, email, password });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('tenant');

      const tenantId = res.body.data.tenant.id;
      const tenant = await db('tenants').where({ id: tenantId }).first();
      expect(tenant).toBeDefined();
      expect(tenant.status).toBe('trial');
      expect(tenant.plan).toBe('base');
      expect(tenant.trial_ends_at).toBeDefined();
      expect(new Date(tenant.trial_ends_at).getTime()).toBeGreaterThan(Date.now());

      // Cleanup
      await db('users').where({ tenant_id: tenantId }).delete();
      await db('tenants').where({ id: tenantId }).delete();
    });
  });

  // ─── 4.6: Expired tenant blocked, SA bypass verified ────────────────────

  describe('4.6 Trial expiry enforcement', () => {
    let expiredTenantId;
    let expiredUserToken;

    beforeAll(async () => {
      // Create an expired tenant
      expiredTenantId = uuidv4();
      await db('tenants').insert({
        id: expiredTenantId,
        name: 'Expired Tenant',
        email: 'expired@tenant.com',
        status: 'expired',
        trial_ends_at: new Date(Date.now() - 86400000), // 1 day ago
      });

      const expiredUserId = uuidv4();
      await db('users').insert({
        id: expiredUserId,
        tenant_id: expiredTenantId,
        email: 'expired-user@tenant.com',
        password_hash: '$2b$12$placeholder',
        role: 'admin',
      });

      // Generate JWT for the expired tenant user
      const jwt = require('jsonwebtoken');
      expiredUserToken = jwt.sign(
        {
          userId: expiredUserId,
          tenantId: expiredTenantId,
          email: 'expired-user@tenant.com',
          role: 'admin',
        },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );
    });

    afterAll(async () => {
      if (db) {
        await db('users').where({ tenant_id: expiredTenantId }).delete();
        await db('devices').where({ tenant_id: expiredTenantId }).delete();
        await db('tenants').where({ id: expiredTenantId }).delete();
      }
    });

    it('blocks expired tenant from protected routes (403)', async () => {
      const res = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${expiredUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
    });

    it('allows super admin access to protected routes despite expired tenant', async () => {
      // Generate a SA token scoped to the expired tenant
      const jwt = require('jsonwebtoken');
      const saExpiredToken = jwt.sign(
        {
          userId: uuidv4(),
          tenantId: expiredTenantId,
          email: 'sa-expired@test.com',
          role: 'super_admin',
        },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      const res = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${saExpiredToken}`);

      // SA bypasses trial expiry — should get 200 with data
      expect(res.status).toBe(200);
    });
  });
});
