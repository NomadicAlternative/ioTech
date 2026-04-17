'use strict';

/**
 * Unit tests for POST /api/v1/devices/claim route handler.
 * Tests the route layer: auth guard, schema validation, service delegation.
 */

jest.mock('../devices.service');
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

const request = require('supertest');
const express = require('express');
const devicesService = require('../devices.service');
const errorHandler = require('../../../shared/middleware/errorHandler');

// Build a minimal app to test just the devices router
function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/devices', require('../devices.routes'));
  app.use(errorHandler);
  return app;
}

const TENANT_ID = 'tenant-uuid-1';
const CLAIM_TOKEN = 'claim-tok-abc';

describe('POST /api/devices/claim', () => {
  let app;
  beforeAll(() => { app = makeApp(); });
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with device data on happy path', async () => {
    devicesService.claimDevice.mockResolvedValue({
      id: 'device-uuid-1',
      status: 'claimed',
      claimed_at: new Date().toISOString(),
    });

    const res = await request(app)
      .post('/api/devices/claim')
      .send({ claim_token: CLAIM_TOKEN });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'claimed' });
    expect(devicesService.claimDevice).toHaveBeenCalledWith(TENANT_ID, CLAIM_TOKEN);
  });

  it('returns 400 when claim_token is missing', async () => {
    const res = await request(app)
      .post('/api/devices/claim')
      .send({});

    expect(res.status).toBe(400);
    expect(devicesService.claimDevice).not.toHaveBeenCalled();
  });

  it('returns 404 when service throws NotFoundError', async () => {
    const { NotFoundError } = require('../../../shared/errors');
    devicesService.claimDevice.mockRejectedValue(new NotFoundError('No device found'));

    const res = await request(app)
      .post('/api/devices/claim')
      .send({ claim_token: 'bad-token' });

    expect(res.status).toBe(404);
  });

  it('returns 409 when service throws ConflictError', async () => {
    const { ConflictError } = require('../../../shared/errors');
    devicesService.claimDevice.mockRejectedValue(new ConflictError('device_already_claimed'));

    const res = await request(app)
      .post('/api/devices/claim')
      .send({ claim_token: CLAIM_TOKEN });

    expect(res.status).toBe(409);
  });
});
