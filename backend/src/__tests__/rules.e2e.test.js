'use strict';

/**
 * E2E tests for the Rules API — rule creation, listing, and full CRUD flow.
 *
 * These tests require a real PostgreSQL database with the schema migrated.
 * They are conditionally skipped unless both DATABASE_URL and
 * TEST_INTEGRATION=true are set in the environment.
 *
 * How to run:
 *   DATABASE_URL=postgres://... TEST_INTEGRATION=true npx jest rules.e2e
 */

const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

// ─── Conditional skip guard ───────────────────────────────────────────────────
const canRunIntegration =
  process.env.DATABASE_URL && process.env.TEST_INTEGRATION === 'true';

(canRunIntegration ? describe : describe.skip)('Rules API — E2E CRUD Flow', () => {
  let app;
  let db;
  let tenantId;
  let authToken;
  let createdRuleId;

  // ─── Setup ─────────────────────────────────────────────────────────────────

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET || 'integration-test-refresh-secret';
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';

    const createApp = require('../app');
    db = require('../shared/db/knex');
    app = createApp();

    // Create a unique tenant for this test run
    tenantId = uuidv4();
    await db('tenants').insert({
      id: tenantId,
      name: `Rules E2E Tenant ${tenantId.slice(0, 8)}`,
    });

    // Register a user and get auth token
    const email = `rules-e2e-${tenantId.slice(0, 8)}@test.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email,
      password: 'TestPass1234!',
      name: 'Rules Tester',
      tenantId,
    });
    authToken = regRes.body.accessToken;
  });

  afterAll(async () => {
    if (db) {
      // Clean up in reverse FK order
      await db('rules').where({ tenant_id: tenantId }).delete();
      await db('users').where({ tenant_id: tenantId }).delete();
      await db('tenants').where({ id: tenantId }).delete();
      await db.destroy();
    }
  });

  // ─── Tests ─────────────────────────────────────────────────────────────────

  it('POST /api/rules — creates a threshold rule and returns 201', async () => {
    const payload = {
      name: 'E2E High Temp',
      description: 'Turn on fan when temp > 30',
      enabled: true,
      triggerType: 'threshold',
      triggerConfig: { field: 'temperature', operator: 'gt', value: 30 },
      actionType: 'relay',
      actionConfig: { relay: 1, state: true },
      cooldownMs: 5000,
    };

    const res = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${authToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toMatchObject({
      name: 'E2E High Temp',
      triggerType: 'threshold',
      actionType: 'relay',
      cooldownMs: 5000,
    });
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.enabled).toBe(true);
    createdRuleId = res.body.data.id;
  });

  it('GET /api/rules — lists the created rule', async () => {
    const res = await request(app)
      .get('/api/rules')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);

    const found = res.body.data.find((r) => r.id === createdRuleId);
    expect(found).toBeDefined();
    expect(found.name).toBe('E2E High Temp');
  });

  it('POST /api/rules — creates a status rule', async () => {
    const payload = {
      name: 'E2E Offline Alert',
      enabled: true,
      triggerType: 'status',
      triggerConfig: { status: 'offline' },
      actionType: 'relay',
      actionConfig: { relay: 2, state: true },
      cooldownMs: 0,
    };

    const res = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${authToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('E2E Offline Alert');
    expect(res.body.data.triggerType).toBe('status');

    // Verify it appears in the list
    const listRes = await request(app)
      .get('/api/rules')
      .set('Authorization', `Bearer ${authToken}`);

    const statusRules = listRes.body.data.filter((r) => r.triggerType === 'status');
    expect(statusRules.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/rules/:id — returns a single rule', async () => {
    const res = await request(app)
      .get(`/api/rules/${createdRuleId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(createdRuleId);
    expect(res.body.data.name).toBe('E2E High Temp');
  });

  it('GET /api/rules/:id — returns 404 for non-existent rule', async () => {
    const res = await request(app)
      .get('/api/rules/non-existent-id')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
  });

  it('PUT /api/rules/:id — updates an existing rule', async () => {
    const payload = {
      name: 'E2E High Temp UPDATED',
      enabled: false,
      cooldownMs: 10000,
    };

    const res = await request(app)
      .put(`/api/rules/${createdRuleId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('E2E High Temp UPDATED');
    expect(res.body.data.enabled).toBe(false);
    expect(res.body.data.cooldownMs).toBe(10000);
  });

  it('DELETE /api/rules/:id — deletes the rule', async () => {
    const res = await request(app)
      .delete(`/api/rules/${createdRuleId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(204);

    // Verify it's gone
    const getRes = await request(app)
      .get(`/api/rules/${createdRuleId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(getRes.status).toBe(404);
  });

  it('POST /api/rules — validates required fields', async () => {
    const res = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${authToken}`)
      .send({}); // empty payload

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /api/rules — rejects invalid triggerConfig', async () => {
    const payload = {
      name: 'Bad Rule',
      triggerType: 'threshold',
      triggerConfig: { field: 'temp' }, // missing operator and value
      actionType: 'relay',
      actionConfig: { relay: 1, state: true },
    };

    const res = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${authToken}`)
      .send(payload);

    expect(res.status).toBe(400);
  });
});
