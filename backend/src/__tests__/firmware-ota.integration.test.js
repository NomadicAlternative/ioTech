'use strict';

/**
 * Integration tests for Firmware OTA flow.
 * Tests the public check endpoint and the authenticated OTA trigger endpoint.
 * Requires: DATABASE_URL + TEST_INTEGRATION=true
 */

const canRunIntegration =
  process.env.DATABASE_URL && process.env.TEST_INTEGRATION === 'true';

(canRunIntegration ? describe : describe.skip)('Firmware OTA Integration', () => {
  const request = require('supertest');
  const { v4: uuidv4 } = require('uuid');

  let app, db, tenantId, authToken, deviceId, templateId, firmwareId;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET || 'integration-test-refresh-secret';
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';

    const createApp = require('../app');
    db = require('../shared/db/knex');
    app = createApp();

    tenantId = uuidv4();
    await db('tenants').insert({
      id: tenantId,
      name: `OTA Test Tenant ${tenantId.slice(0, 8)}`,
    });

    // Create a user and get auth token
    const email = `ota-${tenantId.slice(0, 8)}@test.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email,
      password: 'Test1234!',
      name: 'OTA User',
      tenantId,
    });
    authToken = regRes.body.accessToken;

    // Create a device template with hardware_model
    const tmplRes = await request(app)
      .post('/api/device-templates')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'ESP32-S3 Template',
        description: 'Test template for OTA',
        datastreams: [],
      });
    templateId = tmplRes.body.data.id;

    // Add hardware_model to the template directly in DB (migration not run)
    await db('device_templates').where({ id: templateId }).update({ hardware_model: 'ESP32-S3' });

    // Create a device
    const devRes = await request(app)
      .post('/api/devices')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'OTA Test Device', templateId });
    deviceId = devRes.body.id;
  });

  afterAll(async () => {
    if (db) {
      await db('firmware_versions')
        .where({ tenant_id: tenantId })
        .delete()
        .catch(() => {});
      await db('device_commands')
        .where({ device_id: deviceId })
        .delete()
        .catch(() => {});
      await db('telemetry')
        .where({ device_id: deviceId })
        .delete()
        .catch(() => {});
      await db('devices')
        .where({ id: deviceId })
        .delete()
        .catch(() => {});
      await db('device_templates')
        .where({ id: templateId })
        .delete()
        .catch(() => {});
      await db('users')
        .where({ tenant_id: tenantId })
        .delete()
        .catch(() => {});
      await db('tenants')
        .where({ id: tenantId })
        .delete()
        .catch(() => {});
      await db.destroy();
    }
  });

  // ── GET /api/firmware/check ────────────────────────────────────────────────

  describe('GET /api/firmware/check', () => {
    beforeAll(async () => {
      // Seed firmware versions for the tenant
      const fwRes = await request(app)
        .post('/api/firmware')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          version: '2.0.0',
          hardware_model: 'ESP32-S3',
          download_url: 'https://cdn.example.com/fw/2.0.0.bin',
          release_notes: 'Bug fixes and improvements',
        });
      firmwareId = fwRes.body.data.id;
    });

    afterAll(async () => {
      if (firmwareId) {
        await db('firmware_versions')
          .where({ id: firmwareId })
          .delete()
          .catch(() => {});
      }
    });

    it('returns 200 with version and url when newer firmware exists', async () => {
      const res = await request(app)
        .get('/api/firmware/check')
        .query({ current: '1.0.0', hardware_model: 'ESP32-S3' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        version: '2.0.0',
        url: expect.stringContaining('.bin'),
      });
    });

    it('returns 200 with upToDate when device is already current', async () => {
      const res = await request(app)
        .get('/api/firmware/check')
        .query({ current: '2.0.0', hardware_model: 'ESP32-S3' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ upToDate: true });
    });

    it('returns 200 with upToDate for unknown hardware model', async () => {
      const res = await request(app)
        .get('/api/firmware/check')
        .query({ hardware_model: 'nonexistent-model' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ upToDate: true });
    });

    it('returns 400 when hardware_model is missing', async () => {
      const res = await request(app)
        .get('/api/firmware/check')
        .query({ current: '1.0.0' });

      expect(res.status).toBe(400);
    });

    it('works without auth token (public endpoint)', async () => {
      const res = await request(app)
        .get('/api/firmware/check')
        .query({ hardware_model: 'ESP32-S3' });

      expect(res.status).toBe(200);
    });
  });
});
