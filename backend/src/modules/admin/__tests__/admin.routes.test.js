'use strict';

/**
 * Unit tests for admin routes (GET /dashboard, GET /tenants/:id).
 *
 * Uses supertest to test the route handlers with mocked services + middleware
 * so no real DB connection is needed.
 */

const request = require('supertest');
const express = require('express');
const errorHandler = require('../../../shared/middleware/errorHandler');

// ─── Mocks (hoisted by jest) ──────────────────────────────────────────────────
const mockSchemas = {
  dashboardQuery: { validate: jest.fn() },
  tenantIdParams: { validate: jest.fn() },
};
const mockService = {
  getDashboard: jest.fn(),
  getTenantDetail: jest.fn(),
};
const mockAuthGuard = jest.fn((req, res, next) => {
  req.user = { role: 'super_admin', userId: 'admin-uuid' };
  next();
});
const mockSuperAdminMw = jest.fn((req, res, next) => next());

jest.mock('../admin.schemas', () => mockSchemas);
jest.mock('../admin.service', () => mockService);
jest.mock('../../../shared/middleware/authGuard', () => mockAuthGuard);
jest.mock('../../../shared/middleware/superAdmin', () => mockSuperAdminMw);

describe('admin routes', () => {
  let app;

  beforeAll(() => {
    const adminRoutes = require('../admin.routes');

    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);
    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /api/admin/dashboard ──────────────────────────────────────────────

  describe('GET /api/admin/dashboard', () => {
    it('returns 200 with dashboard KPI data', async () => {
      mockSchemas.dashboardQuery.validate.mockReturnValue({ error: undefined, value: {} });
      mockService.getDashboard.mockResolvedValue({
        totalUsers: 42,
        totalDevices: 15,
        activeDevices: 10,
        totalTenants: 3,
      });

      const res = await request(app).get('/api/admin/dashboard');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toMatchObject({
        totalUsers: 42,
        totalDevices: 15,
        activeDevices: 10,
        totalTenants: 3,
      });
      expect(mockSchemas.dashboardQuery.validate).toHaveBeenCalledWith({});
      expect(mockService.getDashboard).toHaveBeenCalled();
    });

    it('returns 400 when query validation fails', async () => {
      mockSchemas.dashboardQuery.validate.mockReturnValue({
        error: { details: [{ message: '"unknown" is not allowed' }] },
        value: undefined,
      });

      const res = await request(app).get('/api/admin/dashboard?unknown=field');

      expect(res.status).toBe(400);
      expect(mockService.getDashboard).not.toHaveBeenCalled();
    });
  });

  // ─── GET /api/admin/tenants/:id ────────────────────────────────────────────

  describe('GET /api/admin/tenants/:id', () => {
    it('returns 200 with tenant detail', async () => {
      mockSchemas.tenantIdParams.validate.mockReturnValue({
        error: undefined,
        value: { id: '550e8400-e29b-41d4-a716-446655440000' },
      });
      mockService.getTenantDetail.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Tenant',
        deviceCount: 5,
        userCount: 2,
        status: 'active',
      });

      const res = await request(app).get('/api/admin/tenants/550e8400-e29b-41d4-a716-446655440000');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toMatchObject({
        deviceCount: 5,
        userCount: 2,
      });
      expect(mockSchemas.tenantIdParams.validate).toHaveBeenCalledWith({
        id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(mockService.getTenantDetail).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
    });

    it('returns 400 when tenant ID is not a valid UUID', async () => {
      mockSchemas.tenantIdParams.validate.mockReturnValue({
        error: { details: [{ message: '"id" must be a valid GUID' }] },
        value: undefined,
      });

      const res = await request(app).get('/api/admin/tenants/not-a-uuid');

      expect(res.status).toBe(400);
      expect(mockService.getTenantDetail).not.toHaveBeenCalled();
    });
  });
});
