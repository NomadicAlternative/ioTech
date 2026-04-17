'use strict';

/**
 * Integration tests — paginated list response shape for GET /api/devices
 * Uses a lightweight Express app; services are mocked (no DB required).
 */

const express = require('express');
const request = require('supertest');
const errorHandler = require('../../../shared/middleware/errorHandler');

// Mock the devices service
jest.mock('../devices.service');
const devicesService = require('../devices.service');

// Mock authGuard + tenantResolver to skip auth in tests
jest.mock('../../../shared/middleware/authGuard', () => (req, res, next) => {
  req.user = { id: 'user-1', role: 'admin' };
  next();
});
jest.mock('../../../shared/middleware/tenantResolver', () => (req, res, next) => {
  req.tenantId = 'tenant-uuid-paginate';
  next();
});

function createTestApp() {
  const app = express();
  app.use(express.json());

  // Use the real routes module
  const devicesRouter = require('../devices.routes');
  app.use('/devices', devicesRouter);
  app.use(errorHandler);
  return app;
}

describe('GET /devices — paginated list response', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns { data, meta } with correct totalPages when total=45, limit=20', async () => {
    devicesService.list.mockResolvedValue({
      data: Array.from({ length: 20 }, (_, i) => ({ id: `dev-${i}` })),
      total: 45,
    });

    const res = await request(app).get('/devices?page=1&limit=20');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(20);
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 20,
      total: 45,
      totalPages: 3, // Math.ceil(45/20)
    });
  });

  it('clamps limit to 100 and still returns meta', async () => {
    devicesService.list.mockResolvedValue({
      data: [],
      total: 0,
    });

    const res = await request(app).get('/devices?limit=999');

    expect(res.status).toBe(200);
    expect(res.body.meta.limit).toBe(100); // clamped
  });

  it('returns 400 VALIDATION_ERROR when page param is invalid', async () => {
    const res = await request(app).get('/devices?page=abc');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('passes pagination to service', async () => {
    devicesService.list.mockResolvedValue({ data: [], total: 0 });

    await request(app).get('/devices?page=2&limit=10&sortBy=name&sortDir=desc');

    expect(devicesService.list).toHaveBeenCalledWith(
      'tenant-uuid-paginate',
      expect.objectContaining({ page: 2, limit: 10, sortBy: 'name', sortDir: 'desc' })
    );
  });

  it('returns meta.totalPages=1 when total equals limit exactly', async () => {
    devicesService.list.mockResolvedValue({ data: Array.from({ length: 10 }, (_, i) => ({ id: `d-${i}` })), total: 10 });

    const res = await request(app).get('/devices?limit=10');

    expect(res.status).toBe(200);
    expect(res.body.meta.totalPages).toBe(1);
    expect(res.body.meta.total).toBe(10);
  });
});
