'use strict';

/**
 * Integration tests for Auth endpoints + JWT-protected routes.
 *
 * These tests require a real PostgreSQL database with the schema migrated.
 * They are conditionally skipped unless both DATABASE_URL and
 * TEST_INTEGRATION=true are set in the environment.
 *
 * How to run:
 *   DATABASE_URL=postgres://... TEST_INTEGRATION=true npx jest auth.integration
 *
 * The tests use a shared tenant that is inserted at the start of the suite
 * and cleaned up in afterAll.
 */

const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

// ─── Conditional skip guard ───────────────────────────────────────────────────
const canRunIntegration =
  process.env.DATABASE_URL && process.env.TEST_INTEGRATION === 'true';

(canRunIntegration ? describe : describe.skip)('Auth Integration', () => {
  let app;
  let db;
  let tenantId;

  // ─── Setup ─────────────────────────────────────────────────────────────────

  beforeAll(async () => {
    // Set required env vars if running integration tests
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET || 'integration-test-refresh-secret';
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';

    // Import after env vars are set
    const createApp = require('../app');
    db = require('../shared/db/knex');
    app = createApp();

    // Create a unique tenant for this test run so parallel runs don't clash
    tenantId = uuidv4();
    await db('tenants').insert({
      id: tenantId,
      name: `Integration Test Tenant ${tenantId.slice(0, 8)}`,
    });
  });

  afterAll(async () => {
    if (db) {
      // Clean up test data in reverse FK order
      await db('refresh_tokens')
        .whereIn('user_id', db('users').where({ tenant_id: tenantId }).select('id'))
        .delete();
      await db('users').where({ tenant_id: tenantId }).delete();
      await db('tenants').where({ id: tenantId }).delete();
      await db.destroy();
    }
  });

  // ─── POST /api/auth/register ────────────────────────────────────────────────

  describe('POST /api/auth/register', () => {
    const email = `reg-${Date.now()}@example.com`;
    const password = 'TestPass1234!';

    it('registers a new user and returns 201 with user object', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ tenantId, email, password });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toMatchObject({
        email,
        role: 'installer',
        tenantId,
      });
      // Ensure no sensitive fields leaked
      expect(res.body.user.password_hash).toBeUndefined();
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('returns 409 Conflict on duplicate email within the same tenant', async () => {
      // Register the same email again
      const res = await request(app)
        .post('/api/auth/register')
        .send({ tenantId, email, password });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 when email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ tenantId, password });

      expect(res.status).toBe(400);
    });

    it('returns 400 when password is too short', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ tenantId, email: `short-${Date.now()}@example.com`, password: 'abc' });

      expect(res.status).toBe(400);
    });
  });

  // ─── POST /api/auth/login ───────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    const email = `login-${Date.now()}@example.com`;
    const password = 'LoginTest5678!';

    beforeAll(async () => {
      // Pre-register the user
      await request(app)
        .post('/api/auth/register')
        .send({ tenantId, email, password });
    });

    it('returns 200 with accessToken and refreshToken on valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ tenantId, email, password });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(typeof res.body.accessToken).toBe('string');
      expect(typeof res.body.refreshToken).toBe('string');
    });

    it('returns 401 on wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ tenantId, email, password: 'WrongPassword!' });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 401 on unknown email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ tenantId, email: 'ghost@example.com', password });

      expect(res.status).toBe(401);
    });
  });

  // ─── JWT-protected routes ───────────────────────────────────────────────────

  describe('GET /api/devices — JWT guard', () => {
    let accessToken;

    beforeAll(async () => {
      const email = `guard-${Date.now()}@example.com`;
      const password = 'GuardTest99!';

      // Register
      await request(app)
        .post('/api/auth/register')
        .send({ tenantId, email, password });

      // Login to get access token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ tenantId, email, password });

      accessToken = loginRes.body.accessToken;
    });

    it('returns 401 when no Authorization header is provided', async () => {
      const res = await request(app).get('/api/devices');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 401 when Authorization header is malformed', async () => {
      const res = await request(app)
        .get('/api/devices')
        .set('Authorization', 'InvalidToken');

      expect(res.status).toBe(401);
    });

    it('returns 200 with a valid Bearer token', async () => {
      const res = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ─── POST /api/auth/refresh ─────────────────────────────────────────────────

  describe('POST /api/auth/refresh', () => {
    let refreshToken;

    beforeAll(async () => {
      const email = `refresh-${Date.now()}@example.com`;
      const password = 'RefreshTest00!';

      await request(app)
        .post('/api/auth/register')
        .send({ tenantId, email, password });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ tenantId, email, password });

      refreshToken = loginRes.body.refreshToken;
    });

    it('returns 200 with a new accessToken for a valid refreshToken', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(typeof res.body.accessToken).toBe('string');
    });

    it('returns 401 for an invalid/forged refreshToken', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'totally.fake.token' });

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/auth/logout ──────────────────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    it('returns 204 and revokes the refresh token', async () => {
      const email = `logout-${Date.now()}@example.com`;
      const password = 'LogoutTest11!';

      await request(app)
        .post('/api/auth/register')
        .send({ tenantId, email, password });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ tenantId, email, password });

      const { refreshToken } = loginRes.body;

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken });

      expect(logoutRes.status).toBe(204);

      // After logout, the refresh token should no longer be valid
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(refreshRes.status).toBe(401);
    });
  });
});
