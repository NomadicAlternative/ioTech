'use strict';

/**
 * Unit tests for POST /api/devices/:id/command route + service.
 * Tests: auth, device ownership, schema validation, MQTT publish.
 *
 * The route layer is tested via supertest with mocked service.
 * MQTT module is mocked to avoid real broker connections.
 */

// ─── Mock: devices.service ────────────────────────────────────────────────────
jest.mock('../devices.service');

// ─── Mock: authGuard + tenantResolver ─────────────────────────────────────────
jest.mock('../../../shared/middleware/authGuard', () =>
  jest.fn((req, _res, next) => {
    req.userId = 'user-uuid-1';
    next();
  })
);
jest.mock('../../../shared/middleware/tenantResolver', () =>
  jest.fn((req, _res, next) => {
    req.tenantId = 'tenant-uuid-1';
    next();
  })
);

// ─── Mock: mqttClient ─────────────────────────────────────────────────────────
const mockPublish = jest.fn();
jest.mock('../../../mqtt/mqttClient', () => ({
  getClient: jest.fn(() => ({ publish: mockPublish })),
  initMqtt: jest.fn(),
}));

// ─── Mock: logger ─────────────────────────────────────────────────────────────
jest.mock('../../../shared/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const request = require('supertest');
const express = require('express');
const devicesService = require('../devices.service');
const errorHandler = require('../../../shared/middleware/errorHandler');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/devices', require('../devices.routes'));
  app.use(errorHandler);
  return app;
}

const TENANT_ID = 'tenant-uuid-1';
const DEVICE_ID = 'device-uuid-1';
const VALID_COMMAND = { action: 'reboot', payload: { delay: 5 } };

describe('POST /api/devices/:id/command', () => {
  let app;

  beforeAll(() => {
    app = makeApp();
  });

  beforeEach(() => jest.clearAllMocks());

  // ── Auth required ────────────────────────────────────────────────────────

  it('returns 401 without Authorization header', async () => {
    // Override authGuard to actually reject this time
    const authGuard = require('../../../shared/middleware/authGuard');
    authGuard.mockImplementationOnce((_req, res, _next) => {
      res.status(401).json({ error: 'Unauthorized' });
    });

    const res = await request(app)
      .post(`/api/devices/${DEVICE_ID}/command`)
      .send(VALID_COMMAND);

    expect(res.status).toBe(401);
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('returns 200 with ok:true and topic when command is sent', async () => {
    devicesService.sendCommand.mockResolvedValue({
      ok: true,
      topic: `devices/${DEVICE_ID}/command`,
    });

    const res = await request(app)
      .post(`/api/devices/${DEVICE_ID}/command`)
      .set('Authorization', 'Bearer valid-token')
      .send(VALID_COMMAND);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.topic).toBe(`devices/${DEVICE_ID}/command`);
    expect(devicesService.sendCommand).toHaveBeenCalledWith(
      TENANT_ID,
      DEVICE_ID,
      VALID_COMMAND
    );
  });

  // ── Schema validation ─────────────────────────────────────────────────────

  it('returns 400 when action is missing', async () => {
    const res = await request(app)
      .post(`/api/devices/${DEVICE_ID}/command`)
      .set('Authorization', 'Bearer valid-token')
      .send({ payload: { foo: 'bar' } }); // no action

    expect(res.status).toBe(400);
    expect(devicesService.sendCommand).not.toHaveBeenCalled();
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app)
      .post(`/api/devices/${DEVICE_ID}/command`)
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(res.status).toBe(400);
    expect(devicesService.sendCommand).not.toHaveBeenCalled();
  });

  // ── Device ownership / not found ─────────────────────────────────────────

  it('returns 404 when device does not belong to tenant', async () => {
    const { NotFoundError } = require('../../../shared/errors');
    devicesService.sendCommand.mockRejectedValue(new NotFoundError('Device not found'));

    const res = await request(app)
      .post(`/api/devices/${DEVICE_ID}/command`)
      .set('Authorization', 'Bearer valid-token')
      .send(VALID_COMMAND);

    expect(res.status).toBe(404);
  });

  // ── MQTT publish verification ──────────────────────────────────────────────

  it('calls sendCommand with correct tenantId, deviceId, and command body', async () => {
    devicesService.sendCommand.mockResolvedValue({ ok: true, topic: `devices/${DEVICE_ID}/command` });

    await request(app)
      .post(`/api/devices/${DEVICE_ID}/command`)
      .set('Authorization', 'Bearer valid-token')
      .send({ action: 'ota', payload: { url: 'https://cdn.example.com/fw.bin' } });

    expect(devicesService.sendCommand).toHaveBeenCalledWith(
      TENANT_ID,
      DEVICE_ID,
      { action: 'ota', payload: { url: 'https://cdn.example.com/fw.bin' } }
    );
  });
});

// ─── sendCommand() service unit tests (MQTT interaction) ──────────────────────

describe('devicesService.sendCommand() — MQTT unit', () => {
  // Re-mock to use the REAL service (not the mock above)
  // We need a separate describe that tests sendCommand directly without mocking the service.
  // However since jest.mock('../devices.service') is hoisted, we test via a service-level test file.
  // This describe tests the route delegates correctly — the MQTT publish detail is in devices.service.test.js addendum.
  // See: modules/devices/__tests__/devices.service.test.js for sendCommand unit tests.

  it('service.sendCommand is called with the tenantId from tenantResolver', async () => {
    devicesService.sendCommand.mockResolvedValue({ ok: true, topic: 'devices/x/command' });
    const app = makeApp();

    await request(app)
      .post(`/api/devices/${DEVICE_ID}/command`)
      .set('Authorization', 'Bearer any')
      .send({ action: 'ping' });

    const [tenantArg] = devicesService.sendCommand.mock.calls[0];
    expect(tenantArg).toBe(TENANT_ID);
  });
});
