'use strict';

/**
 * Integration tests for firmware CRUD endpoints.
 * Requires: DATABASE_URL + TEST_INTEGRATION=true
 */

const canRunIntegration =
  process.env.DATABASE_URL && process.env.TEST_INTEGRATION === 'true';

(canRunIntegration ? describe : describe.skip)('Phase 4a Integration: Firmware CRUD', () => {
  const request = require('supertest');
  const { v4: uuidv4 } = require('uuid');
  let app, db, tenantId, authToken, firmwareId;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'integration-test-refresh-secret';
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';

    const createApp = require('../app');
    db = require('../shared/db/knex');
    app = createApp();

    tenantId = uuidv4();
    await db('tenants').insert({ id: tenantId, name: `Firmware Test Tenant ${tenantId.slice(0, 8)}` });

    const email = `fw-${tenantId.slice(0, 8)}@test.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email, password: 'Test1234!', name: 'FW User', tenantId,
    });
    authToken = regRes.body.accessToken;
  });

  afterAll(async () => {
    if (db) {
      await db('firmware_versions').where({ tenant_id: tenantId }).delete();
      await db('users').where({ tenant_id: tenantId }).delete();
      await db('tenants').where({ id: tenantId }).delete();
      await db.destroy();
    }
  });

  it('POST /api/firmware — creates a firmware record', async () => {
    const res = await request(app)
      .post('/api/firmware')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ version: '1.0.0', hardware_model: 'ESP32-S3', download_url: 'https://cdn.example.com/fw/1.0.0.bin' });

    expect(res.status).toBe(201);
    expect(res.body.data.version).toBe('1.0.0');
    firmwareId = res.body.data.id;
  });

  it('POST /api/firmware — returns 409 on duplicate version+model', async () => {
    const res = await request(app)
      .post('/api/firmware')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ version: '1.0.0', hardware_model: 'ESP32-S3', download_url: 'https://cdn.example.com/fw/1.0.0.bin' });

    expect(res.status).toBe(409);
  });

  it('GET /api/firmware — lists firmware records', async () => {
    const res = await request(app)
      .get('/api/firmware')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('GET /api/firmware/:id — gets a single record', async () => {
    const res = await request(app)
      .get(`/api/firmware/${firmwareId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(firmwareId);
  });

  it('PATCH /api/firmware/:id — updates a record', async () => {
    const res = await request(app)
      .patch(`/api/firmware/${firmwareId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ release_notes: 'Updated notes' });

    expect(res.status).toBe(200);
    expect(res.body.data.release_notes).toBe('Updated notes');
  });

  it('DELETE /api/firmware/:id — deletes a record', async () => {
    const res = await request(app)
      .delete(`/api/firmware/${firmwareId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(204);
  });

  it('POST /api/firmware — returns 400 when download_url is missing', async () => {
    const res = await request(app)
      .post('/api/firmware')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ version: '2.0.0', hardware_model: 'ESP32-S3' });

    expect(res.status).toBe(400);
  });
});
