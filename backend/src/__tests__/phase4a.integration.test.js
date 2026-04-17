'use strict';

/**
 * Integration tests for Phase 4a endpoints.
 * Requires: DATABASE_URL + TEST_INTEGRATION=true
 *
 * Full claim → provision → MQTT auth flow.
 */

const canRunIntegration =
  process.env.DATABASE_URL && process.env.TEST_INTEGRATION === 'true';

(canRunIntegration ? describe : describe.skip)('Phase 4a Integration: Claim → Provision → MQTT Auth', () => {
  const request = require('supertest');
  const { v4: uuidv4 } = require('uuid');
  let app, db, tenantId, authToken, deviceId;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'integration-test-refresh-secret';
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';

    const createApp = require('../app');
    db = require('../shared/db/knex');
    app = createApp();

    tenantId = uuidv4();
    await db('tenants').insert({ id: tenantId, name: `Phase4a Test Tenant ${tenantId.slice(0, 8)}` });

    // Register + login
    const email = `phase4a-${tenantId.slice(0, 8)}@test.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email, password: 'Test1234!', name: 'Test User', tenantId,
    });
    authToken = regRes.body.accessToken;
  });

  afterAll(async () => {
    if (db) {
      await db('devices').where({ tenant_id: tenantId }).delete();
      await db('users').where({ tenant_id: tenantId }).delete();
      await db('tenants').where({ id: tenantId }).delete();
      await db.destroy();
    }
  });

  it('creates a device (admin sets claim_token)', async () => {
    const res = await request(app)
      .post('/api/devices')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Test Claimable Device' });

    expect(res.status).toBe(201);
    deviceId = res.body.data.id;

    // Manually seed claim_token and set status='unclaimed' to simulate pre-seeding
    await db('devices').where({ id: deviceId }).update({
      claim_token: 'integration-claim-token-001',
      status: 'unclaimed',
      hardware_id: 'HW-TEST-001',
    });
  });

  it('POST /api/devices/claim — claims the device', async () => {
    const res = await request(app)
      .post('/api/devices/claim')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ claim_token: 'integration-claim-token-001' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('claimed');
  });

  it('POST /api/devices/claim — returns 409 on double-claim', async () => {
    const res = await request(app)
      .post('/api/devices/claim')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ claim_token: 'integration-claim-token-001' });

    expect(res.status).toBe(409);
  });

  let provisionedToken;

  it('POST /api/provisioning — provisions the device', async () => {
    const res = await request(app)
      .post('/api/provisioning')
      .send({ claim_token: 'integration-claim-token-001', hardware_id: 'HW-TEST-001' });

    expect(res.status).toBe(200);
    expect(res.body.device_token).toBeDefined();
    expect(res.body.tenant_id).toBe(tenantId);
    provisionedToken = res.body.device_token;
  });

  it('GET /internal/mqtt/auth — allows the provisioned device', async () => {
    const res = await request(app)
      .get('/internal/mqtt/auth')
      .query({ username: deviceId, password: provisionedToken });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ result: 'allow' });
  });

  it('GET /internal/mqtt/auth — denies unknown device', async () => {
    const res = await request(app)
      .get('/internal/mqtt/auth')
      .query({ username: deviceId, password: 'wrong-token' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ result: 'deny' });
  });
});
