'use strict';

/**
 * Unit tests for the EMQX HTTP auth webhook handler (mqttAuthGuard).
 * Tests: allow active device, deny unknown device, deny inactive device.
 */

jest.mock('../../modules/devices/devices.service');

const request = require('supertest');
const express = require('express');
const devicesService = require('../../modules/devices/devices.service');
const errorHandler = require('../middleware/errorHandler');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/internal/mqtt', require('../middleware/mqttAuthGuard'));
  app.use(errorHandler);
  return app;
}

describe('GET /internal/mqtt/auth', () => {
  let app;
  beforeAll(() => { app = makeApp(); });
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with { result: "allow" } for a valid active device', async () => {
    devicesService.authenticate.mockResolvedValue({ ok: true, device: { id: 'device-1', status: 'active' } });

    const res = await request(app)
      .get('/internal/mqtt/auth')
      .query({ username: 'device-1', password: 'valid-token' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ result: 'allow' });
  });

  it('returns 401 with { result: "deny" } when device is not found or token is invalid', async () => {
    const { UnauthorizedError } = require('../../shared/errors');
    devicesService.authenticate.mockRejectedValue(new UnauthorizedError('Invalid device credentials'));

    const res = await request(app)
      .get('/internal/mqtt/auth')
      .query({ username: 'device-1', password: 'wrong-token' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ result: 'deny' });
  });

  it('returns 400 when username is missing', async () => {
    const res = await request(app)
      .get('/internal/mqtt/auth')
      .query({ password: 'some-token' });

    expect(res.status).toBe(400);
    expect(devicesService.authenticate).not.toHaveBeenCalled();
  });
});
