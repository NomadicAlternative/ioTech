'use strict';

/**
 * Integration tests for Auth rate limiting.
 *
 * These tests require a real PostgreSQL database with the schema migrated.
 * They are conditionally skipped unless both DATABASE_URL and
 * TEST_INTEGRATION=true are set in the environment.
 *
 * How to run:
 *   DATABASE_URL=postgres://... TEST_INTEGRATION=true npx jest auth.rateLimit.integration
 *
 * RED phase: rate limiters are not yet wired into auth.routes.js.
 * Requests will NOT be rate-limited — 429 responses won't appear.
 */

const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

// ─── Conditional skip guard ───────────────────────────────────────────────────
const canRunIntegration = process.env.DATABASE_URL && process.env.TEST_INTEGRATION === 'true';

(canRunIntegration ? describe : describe.skip)('Auth Rate Limiting', () => {
  let app;
  let db;
  let tenantId;

  // ─── Setup ─────────────────────────────────────────────────────────────────

  beforeAll(async () => {
    // Required auth env vars for integration tests
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET || 'integration-test-refresh-secret';
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';

    // Set short windows for fast test execution
    process.env.AUTH_RATE_LIMIT_LOGIN_WINDOW_MS = '1000';
    process.env.AUTH_RATE_LIMIT_LOGIN_MAX = '3';
    process.env.AUTH_RATE_LIMIT_REGISTER_WINDOW_MS = '1000';
    process.env.AUTH_RATE_LIMIT_REGISTER_MAX = '3';
    process.env.AUTH_RATE_LIMIT_REFRESH_WINDOW_MS = '1000';
    process.env.AUTH_RATE_LIMIT_REFRESH_MAX = '3';
    process.env.AUTH_RATE_LIMIT_LOGOUT_WINDOW_MS = '1000';
    process.env.AUTH_RATE_LIMIT_LOGOUT_MAX = '3';
    // Ensure rate limiting is enabled for these tests
    process.env.AUTH_RATE_LIMIT_ENABLED = 'true';

    // Reset module cache so rateLimiter.js reads the new env vars
    jest.resetModules();
    const createApp = require('../app');
    db = require('../shared/db/knex');
    app = createApp();

    // Create a unique tenant for this test run
    tenantId = uuidv4();
    await db('tenants').insert({
      id: tenantId,
      name: `RateLimit Test ${tenantId.slice(0, 8)}`,
      email: `tenant-${tenantId.slice(0, 8)}@iotech-test.local`,
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

  // ─── POST /api/auth/login rate limit ────────────────────────────────────────

  describe('POST /api/auth/login rate limit', () => {
    it('returns 429 after exceeding 3 requests in 1s window', async () => {
      // Send 3 requests (within limit)
      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ tenantId, email: `rl-login-${Date.now()}-${i}@test.com`, password: 'Test1234!' });
        expect(res.status).not.toBe(429);
      }

      // 4th request should be rate limited
      const res = await request(app)
        .post('/api/auth/login')
        .send({ tenantId, email: `rl-login-${Date.now()}-over@test.com`, password: 'Test1234!' });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(res.body.error.status).toBe(429);
      expect(res.headers['retry-after']).toBeDefined();
      const retryAfter = parseInt(res.headers['retry-after'], 10);
      expect(retryAfter).toBeGreaterThan(0);
    });

    it('includes RateLimit-* headers on accepted requests', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ tenantId, email: `rl-headers-${Date.now()}@test.com`, password: 'Test1234!' });

      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['ratelimit-remaining']).toBeDefined();
      expect(res.headers['ratelimit-reset']).toBeDefined();
    });

    it('includes RateLimit-* headers on 429 response', async () => {
      // Exhaust the limit
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ tenantId, email: `rl-429h-${Date.now()}-${i}@test.com`, password: 'Test1234!' });
      }

      const res = await request(app)
        .post('/api/auth/login')
        .send({ tenantId, email: `rl-429h-over@test.com`, password: 'Test1234!' });

      expect(res.status).toBe(429);
      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['ratelimit-remaining']).toBe('0');
      expect(res.headers['ratelimit-reset']).toBeDefined();
    });

    it('isolates different tenants from the same IP', async () => {
      // Exhaust tenant-a's limit
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ tenantId, email: `rl-iso-a-${Date.now()}-${i}@test.com`, password: 'Test1234!' });
      }

      // tenant-b should NOT be rate limited (separate key)
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          tenantId: `other-tenant-${Date.now()}`,
          email: `rl-iso-b-${Date.now()}@test.com`,
          password: 'Test1234!',
        });

      expect(res.status).not.toBe(429);
    });
  });

  // ─── POST /api/auth/register rate limit ─────────────────────────────────────

  describe('POST /api/auth/register rate limit', () => {
    it('returns 429 after exceeding register limit', async () => {
      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .post('/api/auth/register')
          .send({ tenantId, email: `rl-reg-${Date.now()}-${i}@test.com`, password: 'Test1234!' });
        expect(res.status).not.toBe(429);
      }

      const res = await request(app)
        .post('/api/auth/register')
        .send({ tenantId, email: `rl-reg-over-${Date.now()}@test.com`, password: 'Test1234!' });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  // ─── POST /api/auth/refresh rate limit ──────────────────────────────────────

  describe('POST /api/auth/refresh rate limit', () => {
    let refreshToken;

    beforeAll(async () => {
      // Register and login to get a refresh token
      const email = `rl-refresh-${Date.now()}@test.com`;
      const password = 'RefreshTest00!';

      await request(app).post('/api/auth/register').send({ tenantId, email, password });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ tenantId, email, password });

      refreshToken = loginRes.body.refreshToken;
    });

    it('returns 429 after exceeding refresh limit', async () => {
      for (let i = 0; i < 3; i++) {
        const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
        expect(res.status).not.toBe(429);
      }

      const res = await request(app).post('/api/auth/refresh').send({ refreshToken });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  // ─── POST /api/auth/logout rate limit ───────────────────────────────────────

  describe('POST /api/auth/logout rate limit', () => {
    let refreshToken;

    beforeAll(async () => {
      const email = `rl-logout-${Date.now()}@test.com`;
      const password = 'LogoutTest11!';

      await request(app).post('/api/auth/register').send({ tenantId, email, password });

      // Need a fresh refreshToken for each request since logout revokes it
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ tenantId, email, password });

      refreshToken = loginRes.body.refreshToken;
    });

    it('returns 429 after exceeding logout limit', async () => {
      // Note: logout returns 204 on success, 429 on rate limit.
      // The refreshToken may be revoked on each logout, so we use the same token
      // for rate-limit counting. The rate limiter doesn't check token validity.
      for (let i = 0; i < 3; i++) {
        const res = await request(app).post('/api/auth/logout').send({ refreshToken });
        expect(res.status).not.toBe(429);
      }

      const res = await request(app).post('/api/auth/logout').send({ refreshToken });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  // ─── Global disable (RB1) ───────────────────────────────────────────────────

  describe('Rate limiting disabled', () => {
    let appDisabled;

    beforeAll(async () => {
      // Set disable flag and recreate app with fresh module cache
      process.env.AUTH_RATE_LIMIT_ENABLED = 'false';
      jest.resetModules();
      const createApp = require('../app');
      appDisabled = createApp();
    });

    afterAll(() => {
      process.env.AUTH_RATE_LIMIT_ENABLED = 'true';
    });

    it('allows unlimited requests when AUTH_RATE_LIMIT_ENABLED=false', async () => {
      for (let i = 0; i < 10; i++) {
        const res = await request(appDisabled)
          .post('/api/auth/login')
          .send({
            tenantId,
            email: `rl-disabled-${Date.now()}-${i}@test.com`,
            password: 'Test1234!',
          });
        expect(res.status).not.toBe(429);
      }
    });

    it('does not emit RateLimit-* headers when disabled', async () => {
      const res = await request(appDisabled)
        .post('/api/auth/login')
        .send({ tenantId, email: `rl-nohdr-${Date.now()}@test.com`, password: 'Test1234!' });

      expect(res.headers['ratelimit-limit']).toBeUndefined();
      expect(res.headers['ratelimit-remaining']).toBeUndefined();
      expect(res.headers['ratelimit-reset']).toBeUndefined();
    });
  });
});
