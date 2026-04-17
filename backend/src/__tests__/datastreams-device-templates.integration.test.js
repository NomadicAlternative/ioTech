'use strict';

/**
 * Integration tests for device-template datastreams + telemetry validation.
 *
 * Covers:
 *   - CRUD device-templates with JSONB datastreams (valid and invalid)
 *   - Telemetry ingest validated against template datastreams
 *   - Legacy template (empty datastreams) passes through
 *   - Device without template_id passes through
 *
 * Requires a real PostgreSQL database with migrations applied.
 *
 * How to run:
 *   DATABASE_URL=postgres://... TEST_INTEGRATION=true npx jest datastreams-device-templates.integration
 */

const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

// ─── Conditional skip guard ───────────────────────────────────────────────────
const canRunIntegration =
  process.env.DATABASE_URL && process.env.TEST_INTEGRATION === 'true';

(canRunIntegration ? describe : describe.skip)(
  'Datastreams — Device Templates Integration',
  () => {
    let app;
    let db;
    let tenantId;
    let token; // access token for test user

    // Ids created during tests — tracked for cleanup
    const createdTemplateIds = [];
    const createdDeviceIds = [];

    // ─── Setup ────────────────────────────────────────────────────────────────

    beforeAll(async () => {
      process.env.JWT_SECRET = process.env.JWT_SECRET || 'datastreams-test-secret';
      process.env.JWT_REFRESH_SECRET =
        process.env.JWT_REFRESH_SECRET || 'datastreams-test-refresh-secret';
      process.env.JWT_EXPIRES_IN = '15m';
      process.env.JWT_REFRESH_EXPIRES_IN = '7d';

      const createApp = require('../app');
      db = require('../shared/db/knex');
      app = createApp();

      tenantId = uuidv4();
      await db('tenants').insert({
        id: tenantId,
        name: `Datastreams Test Tenant – ${tenantId.slice(0, 8)}`,
      });

      const email = `ds-test-${Date.now()}@example.com`;
      const password = 'DatastreamsTest99!';

      await request(app)
        .post('/api/auth/register')
        .send({ tenantId, email, password });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ tenantId, email, password });

      token = loginRes.body.accessToken;
    });

    // ─── Teardown ─────────────────────────────────────────────────────────────

    afterAll(async () => {
      if (db) {
        if (createdDeviceIds.length) {
          await db('telemetry').whereIn('device_id', createdDeviceIds).delete();
          await db('devices').whereIn('id', createdDeviceIds).delete();
        }
        if (createdTemplateIds.length) {
          await db('device_templates').whereIn('id', createdTemplateIds).delete();
        }
        const userIds = await db('users').where({ tenant_id: tenantId }).pluck('id');
        if (userIds.length) {
          await db('refresh_tokens').whereIn('user_id', userIds).delete();
        }
        await db('users').where({ tenant_id: tenantId }).delete();
        await db('tenants').where({ id: tenantId }).delete();
        await db.destroy();
      }
    });

    // ─── CRUD — create ────────────────────────────────────────────────────────

    describe('POST /api/device-templates — create with datastreams', () => {
      it('creates a template with valid datastreams and returns 201', async () => {
        const body = {
          name: 'Temperature Sensor',
          datastreams: [
            { key: 'temperature', name: 'Temperature', direction: 'input', type: 'number', unit: '°C' },
            { key: 'humidity', name: 'Humidity', direction: 'input', type: 'number', unit: '%' },
          ],
        };

        const res = await request(app)
          .post('/api/device-templates')
          .set('Authorization', `Bearer ${token}`)
          .send(body);

        expect(res.status).toBe(201);
        expect(res.body.data).toMatchObject({
          name: 'Temperature Sensor',
        });
        expect(Array.isArray(res.body.data.datastreams)).toBe(true);
        expect(res.body.data.datastreams).toHaveLength(2);
        expect(res.body.data.datastreams[0].key).toBe('temperature');

        // schema must NOT be exposed
        expect(res.body.data.schema).toBeUndefined();

        createdTemplateIds.push(res.body.data.id);
      });

      it('creates a template with empty datastreams (legacy)', async () => {
        const res = await request(app)
          .post('/api/device-templates')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Legacy Sensor', datastreams: [] });

        expect(res.status).toBe(201);
        expect(res.body.data.datastreams).toEqual([]);
        createdTemplateIds.push(res.body.data.id);
      });

      it('returns 422 when datastreams have duplicate keys', async () => {
        const res = await request(app)
          .post('/api/device-templates')
          .set('Authorization', `Bearer ${token}`)
          .send({
            name: 'Bad Sensor',
            datastreams: [
              { key: 'temp', name: 'Temp A', direction: 'input', type: 'number' },
              { key: 'temp', name: 'Temp B', direction: 'input', type: 'number' },
            ],
          });

        expect(res.status).toBe(422);
        expect(res.body.error).toMatch(/datastreams.key.duplicate/);
      });

      it('returns 422 when a datastream is missing required fields', async () => {
        const res = await request(app)
          .post('/api/device-templates')
          .set('Authorization', `Bearer ${token}`)
          .send({
            name: 'Incomplete Sensor',
            datastreams: [
              { key: 'temp', name: 'Temp' }, // missing type and direction
            ],
          });

        expect(res.status).toBe(422);
        expect(res.body.error).toMatch(/datastreams.field.required/);
      });

      it('returns 422 when a datastream has an invalid type', async () => {
        const res = await request(app)
          .post('/api/device-templates')
          .set('Authorization', `Bearer ${token}`)
          .send({
            name: 'Bad Type Sensor',
            datastreams: [
              { key: 'temp', name: 'Temp', direction: 'input', type: 'float' },
            ],
          });

        expect(res.status).toBe(422);
        expect(res.body.error).toMatch(/datastreams.type.invalid/);
      });
    });

    // ─── CRUD — read ──────────────────────────────────────────────────────────

    describe('GET /api/device-templates — read', () => {
      let templateId;

      beforeAll(async () => {
        const res = await request(app)
          .post('/api/device-templates')
          .set('Authorization', `Bearer ${token}`)
          .send({
            name: 'Read Test Sensor',
            datastreams: [
              { key: 'voltage', name: 'Voltage', direction: 'output', type: 'number', unit: 'V' },
            ],
          });

        templateId = res.body.data.id;
        createdTemplateIds.push(templateId);
      });

      it('GET list returns templates with datastreams and without schema', async () => {
        const res = await request(app)
          .get('/api/device-templates')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);

        const found = res.body.data.find((t) => t.id === templateId);
        expect(found).toBeDefined();
        expect(Array.isArray(found.datastreams)).toBe(true);
        expect(found.schema).toBeUndefined();
      });

      it('GET /:id returns template with datastreams and without schema', async () => {
        const res = await request(app)
          .get(`/api/device-templates/${templateId}`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(templateId);
        expect(res.body.data.datastreams).toHaveLength(1);
        expect(res.body.data.datastreams[0].key).toBe('voltage');
        expect(res.body.data.schema).toBeUndefined();
      });

      it('GET /:id returns 404 for unknown id', async () => {
        const res = await request(app)
          .get(`/api/device-templates/${uuidv4()}`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
      });
    });

    // ─── CRUD — update ────────────────────────────────────────────────────────

    describe('PUT /api/device-templates/:id — update datastreams', () => {
      let templateId;

      beforeAll(async () => {
        const res = await request(app)
          .post('/api/device-templates')
          .set('Authorization', `Bearer ${token}`)
          .send({
            name: 'Update Test Sensor',
            datastreams: [
              { key: 'speed', name: 'Speed', direction: 'input', type: 'number' },
            ],
          });

        templateId = res.body.data.id;
        createdTemplateIds.push(templateId);
      });

      it('updates datastreams with a valid payload', async () => {
        const res = await request(app)
          .put(`/api/device-templates/${templateId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            datastreams: [
              { key: 'speed', name: 'Speed', direction: 'input', type: 'number' },
              { key: 'direction', name: 'Direction', direction: 'input', type: 'string' },
            ],
          });

        expect(res.status).toBe(200);
        expect(res.body.data.datastreams).toHaveLength(2);
        expect(res.body.data.datastreams.map((d) => d.key)).toContain('direction');
        expect(res.body.data.schema).toBeUndefined();
      });

      it('returns 422 when updating with invalid datastreams (duplicate keys)', async () => {
        const res = await request(app)
          .put(`/api/device-templates/${templateId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            datastreams: [
              { key: 'dup', name: 'A', direction: 'input', type: 'number' },
              { key: 'dup', name: 'B', direction: 'input', type: 'number' },
            ],
          });

        expect(res.status).toBe(422);
        expect(res.body.error).toMatch(/datastreams.key.duplicate/);
      });

      it('returns 422 when updating with missing required fields in datastream', async () => {
        const res = await request(app)
          .put(`/api/device-templates/${templateId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            datastreams: [{ key: 'x', name: 'X' }], // missing type and direction
          });

        expect(res.status).toBe(422);
        expect(res.body.error).toMatch(/datastreams.field.required/);
      });
    });

    // ─── CRUD — delete ────────────────────────────────────────────────────────

    describe('DELETE /api/device-templates/:id', () => {
      it('deletes a template and returns 204', async () => {
        const createRes = await request(app)
          .post('/api/device-templates')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Delete Me', datastreams: [] });

        const deleteId = createRes.body.data.id;

        const deleteRes = await request(app)
          .delete(`/api/device-templates/${deleteId}`)
          .set('Authorization', `Bearer ${token}`);

        expect(deleteRes.status).toBe(204);

        // Verify it's really gone
        const getRes = await request(app)
          .get(`/api/device-templates/${deleteId}`)
          .set('Authorization', `Bearer ${token}`);

        expect(getRes.status).toBe(404);
      });
    });

    // ─── Telemetry validation ─────────────────────────────────────────────────

    describe('Telemetry ingest — validated against template datastreams', () => {
      const { ingest } = require('../modules/telemetry/telemetry.service');

      let templateWithDatastreamsId;
      let legacyTemplateId;
      let deviceWithTemplateId;
      let deviceWithLegacyTemplateId;
      let deviceWithoutTemplateId;

      beforeAll(async () => {
        // ── Template with datastreams ──────────────────────────────────────────
        const tRes = await request(app)
          .post('/api/device-templates')
          .set('Authorization', `Bearer ${token}`)
          .send({
            name: 'Validated Template',
            datastreams: [
              { key: 'temperature', name: 'Temperature', direction: 'input', type: 'number' },
              { key: 'label', name: 'Label', direction: 'input', type: 'string' },
              { key: 'active', name: 'Active', direction: 'input', type: 'boolean' },
              { key: 'meta', name: 'Meta', direction: 'input', type: 'json' },
              { key: 'actuator', name: 'Actuator', direction: 'output', type: 'boolean' },
            ],
          });

        templateWithDatastreamsId = tRes.body.data.id;
        createdTemplateIds.push(templateWithDatastreamsId);

        // ── Legacy template (empty datastreams) ────────────────────────────────
        const legacyRes = await request(app)
          .post('/api/device-templates')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Legacy Template', datastreams: [] });

        legacyTemplateId = legacyRes.body.data.id;
        createdTemplateIds.push(legacyTemplateId);

        // ── Devices ────────────────────────────────────────────────────────────
        const insertDevice = async (overrides = {}) => {
          const id = uuidv4();
          await db('devices').insert({
            id,
            tenant_id: tenantId,
            name: `Test Device ${id.slice(0, 6)}`,
            device_token: uuidv4(),
            status: 'active',
            metadata: {},
            created_at: new Date(),
            updated_at: new Date(),
            ...overrides,
          });
          createdDeviceIds.push(id);
          return id;
        };

        deviceWithTemplateId = await insertDevice({ template_id: templateWithDatastreamsId });
        deviceWithLegacyTemplateId = await insertDevice({ template_id: legacyTemplateId });
        deviceWithoutTemplateId = await insertDevice();
      });

      it('accepts a valid payload matching template datastreams', async () => {
        const result = await ingest(tenantId, deviceWithTemplateId, {
          temperature: 22.5,
          label: 'zone-A',
        });

        expect(result).not.toBeNull();
        expect(result.id).toBeDefined();
        expect(result.data).toMatchObject({ temperature: 22.5, label: 'zone-A' });
      });

      it('accepts payload with all valid types (number, string, boolean, json)', async () => {
        const result = await ingest(tenantId, deviceWithTemplateId, {
          temperature: 30,
          label: 'zone-B',
          active: true,
          meta: { firmware: '1.0' },
        });

        expect(result).not.toBeNull();
        expect(result.data.active).toBe(true);
        expect(result.data.meta).toEqual({ firmware: '1.0' });
      });

      it('silently drops payload on type mismatch (number expected, string given)', async () => {
        const result = await ingest(tenantId, deviceWithTemplateId, {
          temperature: 'very hot', // type mismatch: should be number
        });

        expect(result).toBeNull();
      });

      it('silently drops payload on type mismatch (boolean expected, number given)', async () => {
        const result = await ingest(tenantId, deviceWithTemplateId, {
          active: 1, // type mismatch: should be boolean
        });

        expect(result).toBeNull();
      });

      it('silently drops payload on type mismatch (json expected, primitive given)', async () => {
        const result = await ingest(tenantId, deviceWithTemplateId, {
          meta: 'not-an-object', // type mismatch: should be json (object)
        });

        expect(result).toBeNull();
      });

      it('accepts payload with unknown keys (not defined in datastreams) — ignored', async () => {
        // unknown keys are silently ignored, the payload is still ingested
        const result = await ingest(tenantId, deviceWithTemplateId, {
          temperature: 25,
          unknownKey: 'should be ignored',
        });

        expect(result).not.toBeNull();
      });

      it('ignores output-direction keys — does not validate them on ingestion', async () => {
        // 'actuator' is direction: output — should be silently ignored (not cause rejection)
        const result = await ingest(tenantId, deviceWithTemplateId, {
          temperature: 20,
          actuator: true, // output direction — ignored during ingestion
        });

        expect(result).not.toBeNull();
      });

      it('accepts telemetry for legacy template (empty datastreams) — skips validation', async () => {
        const result = await ingest(tenantId, deviceWithLegacyTemplateId, {
          anything: 'goes',
          value: 42,
        });

        // Legacy template: no datastreams → skip validation → accept payload
        expect(result).not.toBeNull();
      });

      it('accepts telemetry for device without template_id — no validation', async () => {
        const result = await ingest(tenantId, deviceWithoutTemplateId, {
          raw: 'data',
          count: 99,
        });

        expect(result).not.toBeNull();
        expect(result.data).toMatchObject({ raw: 'data', count: 99 });
      });

      it('returns null (silent drop) for unknown/inactive device', async () => {
        const result = await ingest(tenantId, uuidv4(), { temperature: 10 });
        expect(result).toBeNull();
      });
    });
  }
);
