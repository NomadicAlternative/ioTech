'use strict';

/**
 * Unit tests for dashboards.service.js
 *
 * Covers:
 *  - list()
 *  - getById() — ownership validation
 *  - create() — layout validation, UUID generation
 *  - update() — ownership check before update
 *  - remove() — ownership check before delete
 *  - updateLayout() — valid/invalid layout
 *  - shareWithClient() — ownership + duplicate share (ConflictError)
 *  - revokeClientShare() — ownership + not-found share
 *  - listSharedClients()
 */

// ─── Mock: dashboards.model ───────────────────────────────────────────────────
jest.mock('../dashboards.model');
const dashboardsModel = require('../dashboards.model');

// ─── Mock: logger ─────────────────────────────────────────────────────────────
jest.mock('../../../shared/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const dashboardsService = require('../dashboards.service');
const { NotFoundError, ConflictError, ValidationError } = require('../../../shared/errors');

// ── Fixtures ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-1';
const DASHBOARD_ID = 'dash-uuid-1';
const CLIENT_ID = 'client-uuid-1';

function makeDashboard(overrides = {}) {
  return {
    id: DASHBOARD_ID,
    name: 'My Dashboard',
    description: null,
    layout: JSON.stringify({ widgets: [], gridConfig: {} }),
    installer_id: TENANT_ID,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

const VALID_LAYOUT = { widgets: [], gridConfig: {} };
const INVALID_LAYOUT_NO_WIDGETS = { gridConfig: {} };
const INVALID_LAYOUT_NO_GRID = { widgets: [] };
const INVALID_LAYOUT_NULL = null;

beforeEach(() => jest.clearAllMocks());

// ── list() ────────────────────────────────────────────────────────────────────

describe('dashboardsService.list()', () => {
  it('returns { data, total } from model', async () => {
    dashboardsModel.findAll.mockResolvedValue([makeDashboard()]);
    dashboardsModel.count.mockResolvedValue(1);

    const result = await dashboardsService.list(TENANT_ID, { page: 1, limit: 20 });

    expect(dashboardsModel.findAll).toHaveBeenCalledWith(TENANT_ID, { page: 1, limit: 20 });
    expect(dashboardsModel.count).toHaveBeenCalledWith(TENANT_ID);
    expect(result).toEqual({ data: [expect.objectContaining({ id: DASHBOARD_ID })], total: 1 });
  });

  it('returns empty data and total 0 when no dashboards exist', async () => {
    dashboardsModel.findAll.mockResolvedValue([]);
    dashboardsModel.count.mockResolvedValue(0);

    const result = await dashboardsService.list(TENANT_ID, {});
    expect(result).toEqual({ data: [], total: 0 });
  });
});

// ── getById() ─────────────────────────────────────────────────────────────────

describe('dashboardsService.getById()', () => {
  it('returns dashboard when it exists and belongs to tenant', async () => {
    dashboardsModel.findById.mockResolvedValue(makeDashboard());

    const result = await dashboardsService.getById(TENANT_ID, DASHBOARD_ID);

    expect(dashboardsModel.findById).toHaveBeenCalledWith(TENANT_ID, DASHBOARD_ID);
    expect(result).toMatchObject({ id: DASHBOARD_ID });
  });

  it('throws NotFoundError when dashboard does not exist', async () => {
    dashboardsModel.findById.mockResolvedValue(null);

    await expect(dashboardsService.getById(TENANT_ID, DASHBOARD_ID))
      .rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when dashboard belongs to different tenant (RLS returns null)', async () => {
    dashboardsModel.findById.mockResolvedValue(undefined);

    await expect(dashboardsService.getById('other-tenant', DASHBOARD_ID))
      .rejects.toThrow(NotFoundError);
  });
});

// ── create() ─────────────────────────────────────────────────────────────────

describe('dashboardsService.create()', () => {
  beforeEach(() => {
    dashboardsModel.create.mockImplementation(async (_tid, data) => ({
      ...data,
      created_at: new Date(),
      updated_at: new Date(),
    }));
  });

  it('creates dashboard with auto-generated UUID id', async () => {
    await dashboardsService.create(TENANT_ID, { name: 'New Board' });

    const arg = dashboardsModel.create.mock.calls[0][1];
    expect(arg.id).toBeDefined();
    expect(arg.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('sets installer_id to tenantId', async () => {
    await dashboardsService.create(TENANT_ID, { name: 'Board' });

    const arg = dashboardsModel.create.mock.calls[0][1];
    expect(arg.installer_id).toBe(TENANT_ID);
  });

  it('uses default empty layout when none provided', async () => {
    await dashboardsService.create(TENANT_ID, { name: 'Board' });

    const arg = dashboardsModel.create.mock.calls[0][1];
    expect(JSON.parse(arg.layout)).toEqual({ widgets: [], gridConfig: {} });
  });

  it('accepts valid layout with widgets array', async () => {
    const layout = { widgets: [{ id: 'w1', type: 'gauge', name: 'Temp', x: 0, y: 0, w: 2, h: 2, config: {} }], gridConfig: { cols: 12 } };
    await expect(
      dashboardsService.create(TENANT_ID, { name: 'Board', layout })
    ).resolves.toBeDefined();
  });

  it('throws ValidationError when layout is not an object', async () => {
    await expect(
      dashboardsService.create(TENANT_ID, { name: 'Board', layout: INVALID_LAYOUT_NULL })
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when layout.widgets is missing', async () => {
    await expect(
      dashboardsService.create(TENANT_ID, { name: 'Board', layout: INVALID_LAYOUT_NO_WIDGETS })
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when layout.gridConfig is missing', async () => {
    await expect(
      dashboardsService.create(TENANT_ID, { name: 'Board', layout: INVALID_LAYOUT_NO_GRID })
    ).rejects.toThrow(ValidationError);
  });
});

// ── update() ─────────────────────────────────────────────────────────────────

describe('dashboardsService.update()', () => {
  it('checks ownership before updating', async () => {
    dashboardsModel.findById.mockResolvedValue(makeDashboard());
    dashboardsModel.update.mockResolvedValue(makeDashboard({ name: 'Renamed' }));

    await dashboardsService.update(TENANT_ID, DASHBOARD_ID, { name: 'Renamed' });

    expect(dashboardsModel.findById).toHaveBeenCalledWith(TENANT_ID, DASHBOARD_ID);
    expect(dashboardsModel.update).toHaveBeenCalledWith(TENANT_ID, DASHBOARD_ID, expect.objectContaining({ name: 'Renamed' }));
  });

  it('throws NotFoundError when dashboard not found during ownership check', async () => {
    dashboardsModel.findById.mockResolvedValue(null);

    await expect(
      dashboardsService.update(TENANT_ID, DASHBOARD_ID, { name: 'Renamed' })
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when model update returns nothing (race condition)', async () => {
    dashboardsModel.findById.mockResolvedValue(makeDashboard());
    dashboardsModel.update.mockResolvedValue(undefined);

    await expect(
      dashboardsService.update(TENANT_ID, DASHBOARD_ID, { name: 'Renamed' })
    ).rejects.toThrow(NotFoundError);
  });
});

// ── remove() ─────────────────────────────────────────────────────────────────

describe('dashboardsService.remove()', () => {
  it('checks ownership before deleting', async () => {
    dashboardsModel.findById.mockResolvedValue(makeDashboard());
    dashboardsModel.remove.mockResolvedValue(1);

    await dashboardsService.remove(TENANT_ID, DASHBOARD_ID);

    expect(dashboardsModel.findById).toHaveBeenCalledWith(TENANT_ID, DASHBOARD_ID);
    expect(dashboardsModel.remove).toHaveBeenCalledWith(TENANT_ID, DASHBOARD_ID);
  });

  it('throws NotFoundError when dashboard not found', async () => {
    dashboardsModel.findById.mockResolvedValue(null);

    await expect(dashboardsService.remove(TENANT_ID, DASHBOARD_ID)).rejects.toThrow(NotFoundError);
  });
});

// ── updateLayout() ────────────────────────────────────────────────────────────

describe('dashboardsService.updateLayout()', () => {
  it('validates layout, checks ownership, updates model', async () => {
    dashboardsModel.findById.mockResolvedValue(makeDashboard());
    dashboardsModel.updateLayout.mockResolvedValue(makeDashboard({ layout: JSON.stringify(VALID_LAYOUT) }));

    const result = await dashboardsService.updateLayout(TENANT_ID, DASHBOARD_ID, VALID_LAYOUT);

    expect(dashboardsModel.findById).toHaveBeenCalledWith(TENANT_ID, DASHBOARD_ID);
    expect(dashboardsModel.updateLayout).toHaveBeenCalledWith(TENANT_ID, DASHBOARD_ID, VALID_LAYOUT);
    expect(result).toBeDefined();
  });

  it('throws ValidationError for invalid layout BEFORE ownership check', async () => {
    await expect(
      dashboardsService.updateLayout(TENANT_ID, DASHBOARD_ID, INVALID_LAYOUT_NO_WIDGETS)
    ).rejects.toThrow(ValidationError);

    // model should never be called because validation fails first
    expect(dashboardsModel.findById).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when dashboard not found', async () => {
    dashboardsModel.findById.mockResolvedValue(null);

    await expect(
      dashboardsService.updateLayout(TENANT_ID, DASHBOARD_ID, VALID_LAYOUT)
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when model returns nothing after update (race)', async () => {
    dashboardsModel.findById.mockResolvedValue(makeDashboard());
    dashboardsModel.updateLayout.mockResolvedValue(undefined);

    await expect(
      dashboardsService.updateLayout(TENANT_ID, DASHBOARD_ID, VALID_LAYOUT)
    ).rejects.toThrow(NotFoundError);
  });
});

// ── shareWithClient() ─────────────────────────────────────────────────────────

describe('dashboardsService.shareWithClient()', () => {
  it('checks ownership then adds client', async () => {
    dashboardsModel.findById.mockResolvedValue(makeDashboard());
    dashboardsModel.addClient.mockResolvedValue({ dashboard_id: DASHBOARD_ID, client_id: CLIENT_ID });

    const result = await dashboardsService.shareWithClient(TENANT_ID, DASHBOARD_ID, CLIENT_ID);

    expect(dashboardsModel.findById).toHaveBeenCalledWith(TENANT_ID, DASHBOARD_ID);
    expect(dashboardsModel.addClient).toHaveBeenCalledWith(TENANT_ID, DASHBOARD_ID, CLIENT_ID);
    expect(result).toMatchObject({ client_id: CLIENT_ID });
  });

  it('throws NotFoundError when dashboard not found', async () => {
    dashboardsModel.findById.mockResolvedValue(null);

    await expect(
      dashboardsService.shareWithClient(TENANT_ID, DASHBOARD_ID, CLIENT_ID)
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ConflictError on duplicate share (unique constraint violation code 23505)', async () => {
    dashboardsModel.findById.mockResolvedValue(makeDashboard());
    const pgError = Object.assign(new Error('duplicate key'), { code: '23505' });
    dashboardsModel.addClient.mockRejectedValue(pgError);

    await expect(
      dashboardsService.shareWithClient(TENANT_ID, DASHBOARD_ID, CLIENT_ID)
    ).rejects.toThrow(ConflictError);
  });

  it('re-throws unknown errors from addClient', async () => {
    dashboardsModel.findById.mockResolvedValue(makeDashboard());
    dashboardsModel.addClient.mockRejectedValue(new Error('unexpected DB error'));

    await expect(
      dashboardsService.shareWithClient(TENANT_ID, DASHBOARD_ID, CLIENT_ID)
    ).rejects.toThrow('unexpected DB error');
  });
});

// ── revokeClientShare() ───────────────────────────────────────────────────────

describe('dashboardsService.revokeClientShare()', () => {
  it('checks ownership then removes client share', async () => {
    dashboardsModel.findById.mockResolvedValue(makeDashboard());
    dashboardsModel.removeClient.mockResolvedValue(1);

    await dashboardsService.revokeClientShare(TENANT_ID, DASHBOARD_ID, CLIENT_ID);

    expect(dashboardsModel.removeClient).toHaveBeenCalledWith(TENANT_ID, DASHBOARD_ID, CLIENT_ID);
  });

  it('throws NotFoundError when dashboard not found', async () => {
    dashboardsModel.findById.mockResolvedValue(null);

    await expect(
      dashboardsService.revokeClientShare(TENANT_ID, DASHBOARD_ID, CLIENT_ID)
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when share does not exist (0 rows deleted)', async () => {
    dashboardsModel.findById.mockResolvedValue(makeDashboard());
    dashboardsModel.removeClient.mockResolvedValue(0);

    await expect(
      dashboardsService.revokeClientShare(TENANT_ID, DASHBOARD_ID, CLIENT_ID)
    ).rejects.toThrow(NotFoundError);
  });
});

// ── listSharedClients() ───────────────────────────────────────────────────────

describe('dashboardsService.listSharedClients()', () => {
  it('checks ownership then returns clients from model', async () => {
    const clients = [{ id: CLIENT_ID, name: 'Acme' }];
    dashboardsModel.findById.mockResolvedValue(makeDashboard());
    dashboardsModel.findClientsByDashboard.mockResolvedValue(clients);

    const result = await dashboardsService.listSharedClients(TENANT_ID, DASHBOARD_ID);

    expect(dashboardsModel.findById).toHaveBeenCalledWith(TENANT_ID, DASHBOARD_ID);
    expect(dashboardsModel.findClientsByDashboard).toHaveBeenCalledWith(TENANT_ID, DASHBOARD_ID);
    expect(result).toEqual(clients);
  });

  it('throws NotFoundError when dashboard not found', async () => {
    dashboardsModel.findById.mockResolvedValue(null);

    await expect(
      dashboardsService.listSharedClients(TENANT_ID, DASHBOARD_ID)
    ).rejects.toThrow(NotFoundError);
  });
});
