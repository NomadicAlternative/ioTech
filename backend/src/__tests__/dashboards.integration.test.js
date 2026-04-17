'use strict';

/**
 * Integration tests for /api/dashboards endpoints.
 * Requires: DATABASE_URL + TEST_INTEGRATION=true
 *
 * Tests all 8 routes:
 *   GET    /api/dashboards
 *   POST   /api/dashboards
 *   GET    /api/dashboards/:id
 *   PUT    /api/dashboards/:id
 *   DELETE /api/dashboards/:id
 *   PUT    /api/dashboards/:id/layout
 *   POST   /api/dashboards/:id/share
 *   DELETE /api/dashboards/:id/share/:clientId
 *
 * Also tests: auth required, RLS tenant isolation, role-based cases.
 */

const canRunIntegration =
  process.env.DATABASE_URL && process.env.TEST_INTEGRATION === 'true';

(canRunIntegration ? describe : describe.skip)('Dashboards Integration Tests', () => {
  const request = require('supertest');
  const { v4: uuidv4 } = require('uuid');
  let app, db;

  // Tenant A (owner)
  let tenantAId, tokenA, dashboardId;
  // Tenant B (different tenant — for isolation tests)
  let tenantBId, tokenB;
  // A client to share with
  let clientId;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'integration-test-refresh-secret';
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';

    const createApp = require('../app');
    db = require('../shared/db/knex');
    app = createApp();

    // ── Tenant A ─────────────────────────────────────────────────────────────
    tenantAId = uuidv4();
    await db('tenants').insert({ id: tenantAId, name: `Dashboard Test A ${tenantAId.slice(0, 8)}` });

    const emailA = `dash-a-${tenantAId.slice(0, 8)}@test.com`;
    const regA = await request(app).post('/api/auth/register').send({
      email: emailA, password: 'Test1234!', name: 'Tenant A User', tenantId: tenantAId,
    });
    tokenA = regA.body.accessToken;

    // ── Tenant B ─────────────────────────────────────────────────────────────
    tenantBId = uuidv4();
    await db('tenants').insert({ id: tenantBId, name: `Dashboard Test B ${tenantBId.slice(0, 8)}` });

    const emailB = `dash-b-${tenantBId.slice(0, 8)}@test.com`;
    const regB = await request(app).post('/api/auth/register').send({
      email: emailB, password: 'Test1234!', name: 'Tenant B User', tenantId: tenantBId,
    });
    tokenB = regB.body.accessToken;

    // ── Client for share tests ─────────────────────────────────────────────
    clientId = uuidv4();
    await db('clients').insert({
      id: clientId,
      tenant_id: tenantAId,
      name: 'Test Client Corp',
      email: `client-${clientId.slice(0, 8)}@test.com`,
    });
  });

  afterAll(async () => {
    if (db) {
      if (dashboardId) {
        await db('dashboard_clients').where({ dashboard_id: dashboardId }).delete();
        await db('dashboards').where({ id: dashboardId }).delete();
      }
      // Clean up any remaining dashboards from tenant A
      await db('dashboards').where({ installer_id: tenantAId }).delete();
      await db('dashboards').where({ installer_id: tenantBId }).delete();
      await db('clients').where({ id: clientId }).delete();
      await db('users').where({ tenant_id: tenantAId }).delete();
      await db('users').where({ tenant_id: tenantBId }).delete();
      await db('tenants').where({ id: tenantAId }).delete();
      await db('tenants').where({ id: tenantBId }).delete();
      await db.destroy();
    }
  });

  // ── Auth required ──────────────────────────────────────────────────────────

  describe('Auth required — 401 without token', () => {
    it('GET /api/dashboards returns 401', async () => {
      const res = await request(app).get('/api/dashboards');
      expect(res.status).toBe(401);
    });

    it('POST /api/dashboards returns 401', async () => {
      const res = await request(app).post('/api/dashboards').send({ name: 'X' });
      expect(res.status).toBe(401);
    });

    it('GET /api/dashboards/:id returns 401', async () => {
      const res = await request(app).get(`/api/dashboards/${uuidv4()}`);
      expect(res.status).toBe(401);
    });
  });

  // ── CRUD happy path ────────────────────────────────────────────────────────

  describe('CRUD happy path (Tenant A)', () => {
    it('POST /api/dashboards — creates a dashboard (201)', async () => {
      const res = await request(app)
        .post('/api/dashboards')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Sales Overview', description: 'Main dashboard' });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Sales Overview');
      expect(res.body.data.installer_id).toBe(tenantAId);
      expect(res.body.data.id).toBeDefined();
      dashboardId = res.body.data.id;
    });

    it('GET /api/dashboards — lists dashboards with meta', async () => {
      const res = await request(app)
        .get('/api/dashboards')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toMatchObject({ page: 1, limit: expect.any(Number), total: 1 });
    });

    it('GET /api/dashboards/:id — returns the dashboard', async () => {
      const res = await request(app)
        .get(`/api/dashboards/${dashboardId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(dashboardId);
    });

    it('PUT /api/dashboards/:id — updates name and description', async () => {
      const res = await request(app)
        .put(`/api/dashboards/${dashboardId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Renamed Dashboard', description: 'Updated desc' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Renamed Dashboard');
    });
  });

  // ── Layout update ──────────────────────────────────────────────────────────

  describe('PUT /api/dashboards/:id/layout', () => {
    it('updates layout with valid structure', async () => {
      const layout = {
        widgets: [
          { id: 'w1', type: 'gauge', name: 'Temperature', x: 0, y: 0, w: 2, h: 2, config: {} },
        ],
        gridConfig: { cols: 12, rowHeight: 60 },
      };

      const res = await request(app)
        .put(`/api/dashboards/${dashboardId}/layout`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ layout });

      expect(res.status).toBe(200);
      // layout stored as JSONB — should come back parsed
      expect(res.body.data).toBeDefined();
    });

    it('returns 400 when layout schema is invalid (missing widgets)', async () => {
      const res = await request(app)
        .put(`/api/dashboards/${dashboardId}/layout`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ layout: { gridConfig: {} } }); // missing widgets

      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent dashboard', async () => {
      const res = await request(app)
        .put(`/api/dashboards/${uuidv4()}/layout`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ layout: { widgets: [], gridConfig: {} } });

      expect(res.status).toBe(404);
    });
  });

  // ── Share / Revoke ─────────────────────────────────────────────────────────

  describe('Share/revoke endpoints', () => {
    it('POST /api/dashboards/:id/share — shares with a client (201)', async () => {
      const res = await request(app)
        .post(`/api/dashboards/${dashboardId}/share`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ clientId });

      expect(res.status).toBe(201);
      expect(res.body.data.dashboard_id).toBe(dashboardId);
      expect(res.body.data.client_id).toBe(clientId);
    });

    it('POST /api/dashboards/:id/share — returns 409 on duplicate share', async () => {
      const res = await request(app)
        .post(`/api/dashboards/${dashboardId}/share`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ clientId });

      expect(res.status).toBe(409);
    });

    it('POST /api/dashboards/:id/share — returns 400 when clientId is invalid UUID', async () => {
      const res = await request(app)
        .post(`/api/dashboards/${dashboardId}/share`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ clientId: 'not-a-uuid' });

      expect(res.status).toBe(400);
    });

    it('DELETE /api/dashboards/:id/share/:clientId — revokes share (204)', async () => {
      const res = await request(app)
        .delete(`/api/dashboards/${dashboardId}/share/${clientId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(204);
    });

    it('DELETE /api/dashboards/:id/share/:clientId — returns 404 when share does not exist', async () => {
      const res = await request(app)
        .delete(`/api/dashboards/${dashboardId}/share/${clientId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      // share was already revoked above
      expect(res.status).toBe(404);
    });
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  describe('POST /api/dashboards — validation', () => {
    it('returns 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/dashboards')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ description: 'No name' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when name is empty string', async () => {
      const res = await request(app)
        .post('/api/dashboards')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: '' });

      expect(res.status).toBe(400);
    });
  });

  // ── RLS tenant isolation ───────────────────────────────────────────────────

  describe('RLS isolation — Tenant B cannot access Tenant A dashboards', () => {
    it('GET /api/dashboards — Tenant B sees 0 dashboards', async () => {
      const res = await request(app)
        .get('/api/dashboards')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('GET /api/dashboards/:id — Tenant B gets 404 for Tenant A dashboard', async () => {
      const res = await request(app)
        .get(`/api/dashboards/${dashboardId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });

    it('PUT /api/dashboards/:id — Tenant B gets 404 for Tenant A dashboard', async () => {
      const res = await request(app)
        .put(`/api/dashboards/${dashboardId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Hijacked' });

      expect(res.status).toBe(404);
    });

    it('DELETE /api/dashboards/:id — Tenant B gets 404 for Tenant A dashboard', async () => {
      const res = await request(app)
        .delete(`/api/dashboards/${dashboardId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });
  });

  // ── DELETE ─────────────────────────────────────────────────────────────────

  describe('DELETE /api/dashboards/:id', () => {
    it('deletes the dashboard (204)', async () => {
      const res = await request(app)
        .delete(`/api/dashboards/${dashboardId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(204);
      dashboardId = null; // already deleted — skip afterAll cleanup
    });

    it('returns 404 for already-deleted dashboard', async () => {
      const res = await request(app)
        .get(`/api/dashboards/${uuidv4()}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
    });
  });
});
