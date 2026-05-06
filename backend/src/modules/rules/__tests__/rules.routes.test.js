'use strict';

/**
 * Unit tests for rules.routes.js
 *
 * Tests route registration, middleware chaining, and error handling.
 * Uses supertest with a minimal Express app.
 */

const express = require('express');
const request = require('supertest');

jest.mock('../rules.service');
jest.mock('../../../shared/middleware/authGuard');
jest.mock('../../../shared/middleware/tenantResolver');
jest.mock('../../../shared/middleware/validate', () => {
  return jest.fn(() => (req, res, next) => {
    // Simulate Joi validation: pass through with stripUnknown
    // This lets tests control req.body freely while exercising route handlers
    next();
  });
});

const authGuard = require('../../../shared/middleware/authGuard');
const tenantResolver = require('../../../shared/middleware/tenantResolver');
const rulesService = require('../rules.service');

function createTestApp() {
  const app = express();
  app.use(express.json());
  const router = require('../rules.routes');
  app.use('/api/rules', router);

  // Error handler for tests
  app.use((err, req, res, _next) => {
    const status = err.statusCode || 500;
    res.status(status).json({
      error: { code: err.code || 'UNKNOWN', message: err.message, status },
    });
  });

  return app;
}

describe('rules.routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default middleware mocks
    authGuard.mockImplementation((req, res, next) => {
      req.user = { userId: 'user-1', tenantId: 'tenant-1', role: 'admin' };
      next();
    });
    tenantResolver.mockImplementation((req, res, next) => {
      req.tenantId = req.user.tenantId;
      next();
    });
  });

  // ─── GET / ─────────────────────────────────────────────────────────────────

  describe('GET /api/rules', () => {
    it('returns 200 with list of rules', async () => {
      rulesService.list.mockResolvedValue([
        { id: 'rule-1', name: 'Test Rule', triggerType: 'threshold' },
      ]);

      const res = await request(createTestApp()).get('/api/rules');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('Test Rule');
    });

    it('returns 200 with empty array when no rules', async () => {
      rulesService.list.mockResolvedValue([]);

      const res = await request(createTestApp()).get('/api/rules');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('applies authGuard and tenantResolver', async () => {
      rulesService.list.mockResolvedValue([]);

      await request(createTestApp()).get('/api/rules');

      expect(authGuard).toHaveBeenCalled();
      expect(tenantResolver).toHaveBeenCalled();
      expect(rulesService.list).toHaveBeenCalledWith('tenant-1');
    });
  });

  // ─── POST / ────────────────────────────────────────────────────────────────

  describe('POST /api/rules', () => {
    const VALID_BODY = {
      name: 'New Rule',
      triggerType: 'threshold',
      triggerConfig: { deviceId: '8bb9c9c7-19c9-4682-a9b7-8e217d388cd8', datastreamKey: 'temp', operator: 'gt', value: 25 },
      actionType: 'relay',
      actionConfig: { relay: 1, state: true },
    };

    it('returns 201 with created rule', async () => {
      rulesService.create.mockResolvedValue({ id: 'new-rule', ...VALID_BODY });

      const res = await request(createTestApp())
        .post('/api/rules')
        .send(VALID_BODY);

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ id: 'new-rule' });
    });

    it('passes req.body to service.create', async () => {
      rulesService.create.mockResolvedValue({ id: 'new-rule' });

      await request(createTestApp())
        .post('/api/rules')
        .send(VALID_BODY);

      expect(rulesService.create).toHaveBeenCalledWith('tenant-1', VALID_BODY);
    });
  });

  // ─── GET /:id ──────────────────────────────────────────────────────────────

  describe('GET /api/rules/:id', () => {
    it('returns 200 with the rule', async () => {
      rulesService.getById.mockResolvedValue({ id: 'rule-1', name: 'Test' });

      const res = await request(createTestApp()).get('/api/rules/rule-1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('rule-1');
    });

    it('returns 404 when rule not found', async () => {
      const { NotFoundError } = require('../../../shared/errors');
      rulesService.getById.mockRejectedValue(new NotFoundError('Rule not found'));

      const res = await request(createTestApp()).get('/api/rules/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  // ─── PUT /:id ──────────────────────────────────────────────────────────────

  describe('PUT /api/rules/:id', () => {
    it('returns 200 with updated rule', async () => {
      rulesService.update.mockResolvedValue({ id: 'rule-1', name: 'Updated' });

      const res = await request(createTestApp())
        .put('/api/rules/rule-1')
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated');
    });

    it('returns 404 when rule not found', async () => {
      const { NotFoundError } = require('../../../shared/errors');
      rulesService.update.mockRejectedValue(new NotFoundError('Rule not found'));

      const res = await request(createTestApp())
        .put('/api/rules/nonexistent')
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE /:id ───────────────────────────────────────────────────────────

  describe('DELETE /api/rules/:id', () => {
    it('returns 204 on successful delete', async () => {
      rulesService.remove.mockResolvedValue(undefined);

      const res = await request(createTestApp()).delete('/api/rules/rule-1');

      expect(res.status).toBe(204);
    });

    it('returns 404 when rule not found', async () => {
      const { NotFoundError } = require('../../../shared/errors');
      rulesService.remove.mockRejectedValue(new NotFoundError('Rule not found'));

      const res = await request(createTestApp()).delete('/api/rules/nonexistent');

      expect(res.status).toBe(404);
    });
  });
});
