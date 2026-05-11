'use strict';

/**
 * Route-level tests for firmware endpoints.
 * Tests the public GET /check and authenticated OTA trigger route.
 */

jest.mock('../firmware.service');
jest.mock('../../../shared/middleware/authGuard');
jest.mock('../../../shared/middleware/tenantResolver');
jest.mock('../../../shared/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const request = require('supertest');
const express = require('express');
const firmwareRoutes = require('../firmware.routes');
const { otaRouter } = require('../firmware.routes');
const firmwareService = require('../firmware.service');
const authGuard = require('../../../shared/middleware/authGuard');
const tenantResolver = require('../../../shared/middleware/tenantResolver');

// Make authGuard and tenantResolver pass-through by default
authGuard.mockImplementation((req, res, next) => {
  req.user = { userId: 'user-uuid-1', tenantId: 'tenant-uuid-1', role: 'admin' };
  next();
});
tenantResolver.mockImplementation((req, res, next) => {
  req.tenantId = 'tenant-uuid-1';
  next();
});

describe('GET /api/firmware/check (public)', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());

    // Error handler that logs the error body
    app.use('/api/firmware', firmwareRoutes);
    app.use((err, req, res, _next) => {
      res.status(err.statusCode || 500).json({
        error: err.code || 'INTERNAL_ERROR',
        message: err.message || err.toString(),
        details: err.details,
      });
    });
  });

  it('returns firmware version and url when newer exists', async () => {
    firmwareService.checkLatest.mockResolvedValue({
      version: '2.0.0',
      url: 'https://cdn.example.com/fw/2.0.0.bin',
    });

    const res = await request(app)
      .get('/api/firmware/check')
      .query({ current: '1.0.0', hardware_model: 'ESP32-S3' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      version: '2.0.0',
      url: 'https://cdn.example.com/fw/2.0.0.bin',
    });
    expect(firmwareService.checkLatest).toHaveBeenCalledWith('1.0.0', 'ESP32-S3');
  });

  it('returns upToDate when device is current', async () => {
    firmwareService.checkLatest.mockResolvedValue({ upToDate: true });

    const res = await request(app)
      .get('/api/firmware/check')
      .query({ current: '2.0.0', hardware_model: 'ESP32-S3' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ upToDate: true });
  });

  it('returns 400 when hardware_model is missing', async () => {
    const res = await request(app)
      .get('/api/firmware/check')
      .query({ current: '1.0.0' });

    expect(res.status).toBe(400);
  });

  it('works without auth header (public endpoint)', async () => {
    firmwareService.checkLatest.mockResolvedValue({ upToDate: true });

    const res = await request(app)
      .get('/api/firmware/check')
      .query({ hardware_model: 'ESP32-S3' });

    expect(res.status).toBe(200);
  });
});

describe('POST /api/devices/:id/ota (authenticated)', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/devices', otaRouter);
    app.use((err, req, res, _next) => {
      res.status(err.statusCode || 500).json({
        error: err.code || 'INTERNAL_ERROR',
        message: err.message || err.toString(),
      });
    });
  });

  it('returns 202 on successful OTA trigger', async () => {
    firmwareService.triggerOta.mockResolvedValue({
      ok: true,
      firmware: { version: '2.0.0', url: 'https://cdn.example.com/fw/2.0.0.bin' },
    });

    const res = await request(app)
      .post('/api/devices/device-1/ota')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({
      ok: true,
      firmware: { version: '2.0.0' },
    });
    expect(firmwareService.triggerOta).toHaveBeenCalledWith('tenant-uuid-1', 'device-1', undefined);
  });

  it('returns 202 with requested version when specified', async () => {
    firmwareService.triggerOta.mockResolvedValue({
      ok: true,
      firmware: { version: '2.0.0', url: 'https://cdn.example.com/fw/2.0.0.bin' },
    });

    const res = await request(app)
      .post('/api/devices/device-1/ota')
      .set('Authorization', 'Bearer valid-token')
      .send({ version: '2.0.0' });

    expect(res.status).toBe(202);
    expect(firmwareService.triggerOta).toHaveBeenCalledWith('tenant-uuid-1', 'device-1', '2.0.0');
  });
});
