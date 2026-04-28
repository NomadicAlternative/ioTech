'use strict';

/**
 * Integration tests — dashboards routes (REQ-DASH-025)
 * Tests the route layer: auth guard, schema validation, service delegation.
 * Services are mocked; no DB required.
 */

jest.mock('../dashboards.service');
jest.mock('../../../shared/middleware/authGuard', () =>
  jest.fn((req, _res, next) => {
    req.user = { userId: 'installer-uuid-1', tenantId: 'tenant-uuid-1', role: 'installer' };
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
const dashboardsService = require('../dashboards.service');
const errorHandler = require('../../../shared/middleware/errorHandler');
const { NotFoundError, ForbiddenError, ConflictError, UnauthorizedError } = require('../../../shared/errors');

const authGuard = require('../../../shared/middleware/authGuard');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/dashboards', require('../dashboards.routes'));
  app.use(errorHandler);
  return app;
}

const TENANT_ID = 'tenant-uuid-1';
const USER_ID = 'installer-uuid-1';
const DASH_ID = 'dash-uuid-1';
const CLIENT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const VALID_LAYOUT = {
  widgets: [],
  gridConfig: { cols: 12, rowHeight: 100 },
};

const VALID_WIDGET = {
  i: 'w1',
  widgetType: 'gauge',
  x: 0,
  y: 0,
  w: 3,
  h: 2,
  config: {},
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Simulate unauthenticated request by making authGuard throw 401 */
function withoutAuth() {
  authGuard.mockImplementationOnce((_req, _res, next) => {
    next(new UnauthorizedError('Missing or malformed Authorization header'));
  });
}

/** Simulate a client role user */
function asClient() {
  authGuard.mockImplementationOnce((req, _res, next) => {
    req.user = { userId: 'client-uuid-1', tenantId: 'tenant-uuid-1', role: 'client' };
    next();
  });
}

// ── Setup ──────────────────────────────────────────────────────────────────────

let app;
beforeAll(() => { app = makeApp(); });
beforeEach(() => jest.clearAllMocks());

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/dashboards
// ══════════════════════════════════════════════════════════════════════════════

describe('GET /api/dashboards', () => {
  it('200 returns installer dashboards with meta', async () => {
    dashboardsService.list.mockResolvedValue({ data: [{ id: DASH_ID, name: 'My Dash' }], total: 1 });

    const res = await request(app).get('/api/dashboards');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ page: 1, total: 1 });
    expect(dashboardsService.list).toHaveBeenCalledWith(TENANT_ID, USER_ID, expect.any(Object));
  });

  it('401 without token', async () => {
    withoutAuth();

    const res = await request(app).get('/api/dashboards');

    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/dashboards
// ══════════════════════════════════════════════════════════════════════════════

describe('POST /api/dashboards', () => {
  it('201 creates dashboard with name + description', async () => {
    const created = { id: DASH_ID, name: 'My Dash', description: 'desc' };
    dashboardsService.create.mockResolvedValue(created);

    const res = await request(app)
      .post('/api/dashboards')
      .send({ name: 'My Dash', description: 'desc' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ id: DASH_ID, name: 'My Dash' });
    expect(dashboardsService.create).toHaveBeenCalledWith(TENANT_ID, USER_ID, expect.objectContaining({ name: 'My Dash' }));
  });

  it('400 missing name', async () => {
    const res = await request(app)
      .post('/api/dashboards')
      .send({ description: 'no name here' });

    expect(res.status).toBe(400);
    expect(dashboardsService.create).not.toHaveBeenCalled();
  });

  it('401 without token', async () => {
    withoutAuth();

    const res = await request(app)
      .post('/api/dashboards')
      .send({ name: 'My Dash' });

    expect(res.status).toBe(401);
  });

  it('403 if service throws ForbiddenError (client role)', async () => {
    dashboardsService.create.mockRejectedValue(new ForbiddenError('Only installers can create dashboards'));

    const res = await request(app)
      .post('/api/dashboards')
      .send({ name: 'My Dash' });

    expect(res.status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/dashboards/:id
// ══════════════════════════════════════════════════════════════════════════════

describe('GET /api/dashboards/:id', () => {
  it('200 owner can get their dashboard', async () => {
    const dash = { id: DASH_ID, name: 'My Dash', installer_id: USER_ID };
    dashboardsService.getById.mockResolvedValue(dash);

    const res = await request(app).get(`/api/dashboards/${DASH_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: DASH_ID });
    expect(dashboardsService.getById).toHaveBeenCalledWith(TENANT_ID, USER_ID, DASH_ID);
  });

  it('200 shared client can get the dashboard', async () => {
    const dash = { id: DASH_ID, name: 'Shared Dash' };
    dashboardsService.getById.mockResolvedValue(dash);
    asClient();

    const res = await request(app).get(`/api/dashboards/${DASH_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: DASH_ID });
  });

  it('404 wrong tenant / not found', async () => {
    dashboardsService.getById.mockRejectedValue(new NotFoundError('Dashboard not found'));

    const res = await request(app).get(`/api/dashboards/nonexistent-id`);

    expect(res.status).toBe(404);
  });

  it('401 without token', async () => {
    withoutAuth();

    const res = await request(app).get(`/api/dashboards/${DASH_ID}`);

    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PUT /api/dashboards/:id
// ══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/dashboards/:id', () => {
  it('200 updates name/description', async () => {
    const updated = { id: DASH_ID, name: 'Updated', description: 'new desc' };
    dashboardsService.update.mockResolvedValue(updated);

    const res = await request(app)
      .put(`/api/dashboards/${DASH_ID}`)
      .send({ name: 'Updated', description: 'new desc' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Updated' });
    expect(dashboardsService.update).toHaveBeenCalledWith(TENANT_ID, USER_ID, DASH_ID, expect.objectContaining({ name: 'Updated' }));
  });

  it('404 not found', async () => {
    dashboardsService.update.mockRejectedValue(new NotFoundError('Dashboard not found'));

    const res = await request(app)
      .put(`/api/dashboards/bad-id`)
      .send({ name: 'X' });

    expect(res.status).toBe(404);
  });

  it('403 client cannot update', async () => {
    dashboardsService.update.mockRejectedValue(new ForbiddenError('Only owners can update'));

    const res = await request(app)
      .put(`/api/dashboards/${DASH_ID}`)
      .send({ name: 'X' });

    expect(res.status).toBe(403);
  });

  it('401 without token', async () => {
    withoutAuth();

    const res = await request(app)
      .put(`/api/dashboards/${DASH_ID}`)
      .send({ name: 'X' });

    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DELETE /api/dashboards/:id
// ══════════════════════════════════════════════════════════════════════════════

describe('DELETE /api/dashboards/:id', () => {
  it('204 owner deletes their dashboard', async () => {
    dashboardsService.remove.mockResolvedValue();

    const res = await request(app).delete(`/api/dashboards/${DASH_ID}`);

    expect(res.status).toBe(204);
    expect(dashboardsService.remove).toHaveBeenCalledWith(TENANT_ID, USER_ID, DASH_ID);
  });

  it('404 not found', async () => {
    dashboardsService.remove.mockRejectedValue(new NotFoundError('Dashboard not found'));

    const res = await request(app).delete(`/api/dashboards/bad-id`);

    expect(res.status).toBe(404);
  });

  it('403 client cannot delete', async () => {
    dashboardsService.remove.mockRejectedValue(new ForbiddenError('Only owners can delete'));

    const res = await request(app).delete(`/api/dashboards/${DASH_ID}`);

    expect(res.status).toBe(403);
  });

  it('401 without token', async () => {
    withoutAuth();

    const res = await request(app).delete(`/api/dashboards/${DASH_ID}`);

    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PUT /api/dashboards/:id/layout
// ══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/dashboards/:id/layout', () => {
  it('200 valid layout saved', async () => {
    const updated = { id: DASH_ID, layout: { widgets: [VALID_WIDGET], gridConfig: {} } };
    dashboardsService.updateLayout.mockResolvedValue(updated);

    const res = await request(app)
      .put(`/api/dashboards/${DASH_ID}/layout`)
      .send({ layout: { widgets: [VALID_WIDGET], gridConfig: {} } });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: DASH_ID });
    expect(dashboardsService.updateLayout).toHaveBeenCalledWith(
      TENANT_ID, USER_ID, DASH_ID,
      expect.objectContaining({ widgets: expect.any(Array) })
    );
  });

  it('400 invalid layout — widgets not an array', async () => {
    const res = await request(app)
      .put(`/api/dashboards/${DASH_ID}/layout`)
      .send({ layout: { widgets: 'not-an-array', gridConfig: {} } });

    expect(res.status).toBe(400);
    expect(dashboardsService.updateLayout).not.toHaveBeenCalled();
  });

  it('400 invalid layout — widget missing widgetType', async () => {
    const badWidget = { i: 'w1', x: 0, y: 0, w: 3, h: 2 }; // missing widgetType
    const res = await request(app)
      .put(`/api/dashboards/${DASH_ID}/layout`)
      .send({ layout: { widgets: [badWidget], gridConfig: {} } });

    expect(res.status).toBe(400);
    expect(dashboardsService.updateLayout).not.toHaveBeenCalled();
  });

  it('400 missing layout field entirely', async () => {
    const res = await request(app)
      .put(`/api/dashboards/${DASH_ID}/layout`)
      .send({ something: 'else' });

    expect(res.status).toBe(400);
    expect(dashboardsService.updateLayout).not.toHaveBeenCalled();
  });

  it('403 service throws ForbiddenError (client cannot update layout)', async () => {
    dashboardsService.updateLayout.mockRejectedValue(new ForbiddenError('Only owners can update layout'));

    const res = await request(app)
      .put(`/api/dashboards/${DASH_ID}/layout`)
      .send({ layout: VALID_LAYOUT });

    expect(res.status).toBe(403);
  });

  it('401 without token', async () => {
    withoutAuth();

    const res = await request(app)
      .put(`/api/dashboards/${DASH_ID}/layout`)
      .send({ layout: VALID_LAYOUT });

    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/dashboards/:id/share
// ══════════════════════════════════════════════════════════════════════════════

describe('POST /api/dashboards/:id/share', () => {
  it('201 shares with valid clientId', async () => {
    const record = { dashboard_id: DASH_ID, client_id: CLIENT_ID };
    dashboardsService.shareWithClient.mockResolvedValue(record);

    const res = await request(app)
      .post(`/api/dashboards/${DASH_ID}/share`)
      .send({ clientId: CLIENT_ID });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ client_id: CLIENT_ID });
    expect(dashboardsService.shareWithClient).toHaveBeenCalledWith(TENANT_ID, USER_ID, DASH_ID, CLIENT_ID);
  });

  it('404 dashboard not found', async () => {
    dashboardsService.shareWithClient.mockRejectedValue(new NotFoundError('Dashboard not found'));

    const res = await request(app)
      .post(`/api/dashboards/bad-id/share`)
      .send({ clientId: CLIENT_ID });

    expect(res.status).toBe(404);
  });

  it('409 already shared', async () => {
    dashboardsService.shareWithClient.mockRejectedValue(new ConflictError('Already shared with this client'));

    const res = await request(app)
      .post(`/api/dashboards/${DASH_ID}/share`)
      .send({ clientId: CLIENT_ID });

    expect(res.status).toBe(409);
  });

  it('400 missing clientId', async () => {
    const res = await request(app)
      .post(`/api/dashboards/${DASH_ID}/share`)
      .send({});

    expect(res.status).toBe(400);
    expect(dashboardsService.shareWithClient).not.toHaveBeenCalled();
  });

  it('400 invalid clientId (not uuid)', async () => {
    const res = await request(app)
      .post(`/api/dashboards/${DASH_ID}/share`)
      .send({ clientId: 'not-a-uuid' });

    expect(res.status).toBe(400);
    expect(dashboardsService.shareWithClient).not.toHaveBeenCalled();
  });

  it('401 without token', async () => {
    withoutAuth();

    const res = await request(app)
      .post(`/api/dashboards/${DASH_ID}/share`)
      .send({ clientId: CLIENT_ID });

    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DELETE /api/dashboards/:id/share/:clientId
// ══════════════════════════════════════════════════════════════════════════════

describe('DELETE /api/dashboards/:id/share/:clientId', () => {
  it('204 revoke succeeds', async () => {
    dashboardsService.revokeClientShare.mockResolvedValue();

    const res = await request(app).delete(`/api/dashboards/${DASH_ID}/share/${CLIENT_ID}`);

    expect(res.status).toBe(204);
    expect(dashboardsService.revokeClientShare).toHaveBeenCalledWith(TENANT_ID, USER_ID, DASH_ID, CLIENT_ID);
  });

  it('404 dashboard not found', async () => {
    dashboardsService.revokeClientShare.mockRejectedValue(new NotFoundError('Dashboard not found'));

    const res = await request(app).delete(`/api/dashboards/bad-id/share/${CLIENT_ID}`);

    expect(res.status).toBe(404);
  });

  it('404 client not shared', async () => {
    dashboardsService.revokeClientShare.mockRejectedValue(new NotFoundError('Client not shared with this dashboard'));

    const res = await request(app).delete(`/api/dashboards/${DASH_ID}/share/not-shared-client`);

    expect(res.status).toBe(404);
  });

  it('401 without token', async () => {
    withoutAuth();

    const res = await request(app).delete(`/api/dashboards/${DASH_ID}/share/${CLIENT_ID}`);

    expect(res.status).toBe(401);
  });
});
