'use strict';

/**
 * Integration tests for Swagger/OpenAPI documentation endpoints.
 *
 * These tests use the createApp factory directly — no DB needed.
 * They verify that /api-docs is accessible without auth and that
 * the OpenAPI JSON endpoint returns a valid spec.
 */

const request = require('supertest');

// Set required env vars before requiring app
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';

const createApp = require('../app');

describe('Swagger / OpenAPI documentation', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  // ─── Task 9: /api-docs endpoint accessible without auth ──────────────────────

  describe('GET /api-docs', () => {
    it('returns 200 HTML without an Authorization header', async () => {
      const res = await request(app).get('/api-docs');
      // swagger-ui-express redirects /api-docs → /api-docs/ with 301
      // both are acceptable; status should be 2xx or 3xx redirect to HTML
      expect([200, 301, 302]).toContain(res.status);
    });

    it('returns HTML content at /api-docs/ (trailing slash)', async () => {
      const res = await request(app).get('/api-docs/');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/html/);
    });
  });

  // ─── Task 9: OpenAPI JSON endpoint ───────────────────────────────────────────

  describe('GET /api-docs/swagger.json', () => {
    it('returns 200 with valid OpenAPI JSON containing info.title', async () => {
      const res = await request(app).get('/api-docs/swagger.json');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/json/);
      expect(res.body).toHaveProperty('openapi');
      expect(res.body.openapi).toMatch(/^3\./);
      expect(res.body).toHaveProperty('info');
      expect(res.body.info).toHaveProperty('title', 'ioTech API');
    });

    it('returns a spec with at least one path defined', async () => {
      const res = await request(app).get('/api-docs/swagger.json');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('paths');
      const pathCount = Object.keys(res.body.paths || {}).length;
      expect(pathCount).toBeGreaterThan(0);
    });
  });

  // ─── Task 10: All routes have OpenAPI annotations ────────────────────────────

  describe('OpenAPI paths coverage', () => {
    let spec;

    beforeAll(async () => {
      const res = await request(app).get('/api-docs/swagger.json');
      spec = res.body;
    });

    it('covers auth routes (register, login, refresh, logout)', () => {
      const paths = Object.keys(spec.paths || {});
      expect(paths).toContain('/api/auth/register');
      expect(paths).toContain('/api/auth/login');
      expect(paths).toContain('/api/auth/refresh');
      expect(paths).toContain('/api/auth/logout');
    });

    it('covers devices routes (list, getById, create, update, delete, authenticate)', () => {
      const paths = Object.keys(spec.paths || {});
      expect(paths).toContain('/api/devices');
      expect(paths).toContain('/api/devices/{id}');
      expect(paths).toContain('/api/devices/{id}/authenticate');
    });

    it('covers clients routes (list, getById, create, update, delete)', () => {
      const paths = Object.keys(spec.paths || {});
      expect(paths).toContain('/api/clients');
      expect(paths).toContain('/api/clients/{id}');
    });

    it('covers device-templates routes', () => {
      const paths = Object.keys(spec.paths || {});
      expect(paths).toContain('/api/device-templates');
      expect(paths).toContain('/api/device-templates/{id}');
    });

    it('covers installers routes', () => {
      const paths = Object.keys(spec.paths || {});
      expect(paths).toContain('/api/installers');
      expect(paths).toContain('/api/installers/{id}');
    });

    it('covers telemetry routes', () => {
      const paths = Object.keys(spec.paths || {});
      expect(paths).toContain('/api/telemetry/devices/{deviceId}/telemetry');
    });

    it('has at least 14 total paths covering all modules', () => {
      const pathCount = Object.keys(spec.paths || {}).length;
      expect(pathCount).toBeGreaterThanOrEqual(14);
    });
  });
});
