'use strict';

/**
 * Unit tests for dashboards.model.js
 * withTenant is mocked to call the callback immediately with a fake trx.
 * All DB interaction is verified via the trx mock calls.
 */

// ─── Mock: shared/db/tenant-knex ────────────────────────────────────────────
jest.mock('../../../shared/db/tenant-knex');
const { withTenant } = require('../../../shared/db/tenant-knex');

const dashboardsModel = require('../dashboards.model');

const TENANT_ID = 'tenant-uuid-1';
const OWNER_ID = TENANT_ID;
const DASHBOARD_ID = 'dash-uuid-1';
const CLIENT_ID = 'client-uuid-1';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

/**
 * Build a chainable trx mock that resolves with `result` at the end.
 * Supports: insert, update, delete, where, first, returning, then, join, select, count, orderBy, limit, offset
 */
function makeTrx(opts = {}) {
  const {
    insertResult = [makeDashboard()],
    _updateResult = [makeDashboard()],
    deleteResult = 1,
    firstResult = makeDashboard(),
    selectResult = [],
    countResult = [{ count: '3' }],
    findAllResult = [makeDashboard()],
  } = opts;

  const chain = {
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockResolvedValue(deleteResult),
    where: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(firstResult),
    returning: jest.fn().mockReturnThis(),
    join: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue(selectResult),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockResolvedValue(findAllResult),
    count: jest.fn().mockResolvedValue(countResult),
    // then allows .then(([row]) => row) on returning() results
    then: jest.fn((cb) => Promise.resolve(cb ? cb(insertResult) : insertResult)),
  };

  // Make returning().then() work for insert/update
  chain.returning.mockImplementation(() => ({
    then: jest.fn((cb) => Promise.resolve(cb ? cb(insertResult) : insertResult)),
  }));

  const trx = jest.fn(() => chain);
  trx.fn = { now: jest.fn(() => 'NOW()') };
  trx.__chain = chain;
  return trx;
}

// ── create() ─────────────────────────────────────────────────────────────────

describe('dashboardsModel.create()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls withTenant with the tenantId', async () => {
    const trx = makeTrx();
    withTenant.mockImplementation(async (tid, cb) => cb(trx));
    await dashboardsModel.create(TENANT_ID, { id: DASHBOARD_ID, name: 'Test', installer_id: TENANT_ID });
    expect(withTenant).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
  });

  it('inserts into dashboards table and returns first row', async () => {
    const expected = makeDashboard({ name: 'New' });
    const trx = makeTrx({ insertResult: [expected] });
    withTenant.mockImplementation(async (tid, cb) => cb(trx));

    const result = await dashboardsModel.create(TENANT_ID, { id: DASHBOARD_ID, name: 'New' });

    expect(trx).toHaveBeenCalledWith('dashboards');
    expect(result).toEqual(expected);
  });
});

// ── findAll() ─────────────────────────────────────────────────────────────────

describe('dashboardsModel.findAll()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('applies pagination offset correctly (page 2 limit 10)', async () => {
    const trx = makeTrx();
    withTenant.mockImplementation(async (tid, cb) => cb(trx));

    await dashboardsModel.findAll(TENANT_ID, OWNER_ID, { page: 2, limit: 10 });

    expect(trx.__chain.limit).toHaveBeenCalledWith(10);
    expect(trx.__chain.offset).toHaveBeenCalledWith(10); // (2-1)*10
  });

  it('falls back to created_at desc when sortBy is null', async () => {
    const trx = makeTrx();
    withTenant.mockImplementation(async (tid, cb) => cb(trx));

    await dashboardsModel.findAll(TENANT_ID, OWNER_ID, { page: 1, limit: 20, sortBy: null, sortDir: 'asc' });

    expect(trx.__chain.orderBy).toHaveBeenCalledWith('created_at', 'desc');
  });

  it('uses provided sortBy and sortDir', async () => {
    const trx = makeTrx();
    withTenant.mockImplementation(async (tid, cb) => cb(trx));

    await dashboardsModel.findAll(TENANT_ID, OWNER_ID, { page: 1, limit: 20, sortBy: 'name', sortDir: 'asc' });

    expect(trx.__chain.orderBy).toHaveBeenCalledWith('name', 'asc');
  });

  it('filters by installer_id (tenant scoping)', async () => {
    const trx = makeTrx();
    withTenant.mockImplementation(async (tid, cb) => cb(trx));

    await dashboardsModel.findAll(TENANT_ID, OWNER_ID, {});

    expect(trx.__chain.where).toHaveBeenCalledWith({ installer_id: TENANT_ID });
  });
});

// ── count() ───────────────────────────────────────────────────────────────────

describe('dashboardsModel.count()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns parsed integer count', async () => {
    withTenant.mockImplementation(async (tid, cb) => {
      const trx = jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        count: jest.fn().mockResolvedValue([{ count: '7' }]),
      }));
      return cb(trx);
    });

    const result = await dashboardsModel.count(TENANT_ID);
    expect(result).toBe(7);
  });

  it('returns 0 when no dashboards exist', async () => {
    withTenant.mockImplementation(async (tid, cb) => {
      const trx = jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        count: jest.fn().mockResolvedValue([{ count: '0' }]),
      }));
      return cb(trx);
    });

    const result = await dashboardsModel.count(TENANT_ID);
    expect(result).toBe(0);
  });
});

// ── findById() ────────────────────────────────────────────────────────────────

describe('dashboardsModel.findById()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('queries by installer_id and id', async () => {
    const trx = makeTrx();
    withTenant.mockImplementation(async (tid, cb) => cb(trx));

    await dashboardsModel.findById(TENANT_ID, OWNER_ID, DASHBOARD_ID);

    expect(trx.__chain.where).toHaveBeenCalledWith({ installer_id: TENANT_ID, id: DASHBOARD_ID });
    expect(trx.__chain.first).toHaveBeenCalled();
  });

  it('returns undefined when no row found (RLS fail — wrong tenant)', async () => {
    const trx = makeTrx({ firstResult: null });
    withTenant.mockImplementation(async (tid, cb) => cb(trx));

    const result = await dashboardsModel.findById('wrong-tenant', OWNER_ID, DASHBOARD_ID);
    expect(result).toBeNull();
  });
});

// ── update() ─────────────────────────────────────────────────────────────────

describe('dashboardsModel.update()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates with installer_id + id where clause and returns updated row', async () => {
    const updated = makeDashboard({ name: 'Updated' });
    const chain = {
      where: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnValue({
        then: jest.fn((cb) => Promise.resolve(cb([updated]))),
      }),
    };
    const trx = jest.fn(() => chain);
    trx.fn = { now: jest.fn(() => 'NOW()') };
    withTenant.mockImplementation(async (tid, cb) => cb(trx));

    const result = await dashboardsModel.update(TENANT_ID, OWNER_ID, DASHBOARD_ID, { name: 'Updated' });

    expect(chain.where).toHaveBeenCalledWith({ installer_id: TENANT_ID, id: DASHBOARD_ID });
    expect(result).toEqual(updated);
  });
});

// ── remove() ─────────────────────────────────────────────────────────────────

describe('dashboardsModel.remove()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes by installer_id and id', async () => {
    const chain = {
      where: jest.fn().mockReturnThis(),
      delete: jest.fn().mockResolvedValue(1),
    };
    const trx = jest.fn(() => chain);
    withTenant.mockImplementation(async (tid, cb) => cb(trx));

    const result = await dashboardsModel.remove(TENANT_ID, OWNER_ID, DASHBOARD_ID);

    expect(chain.where).toHaveBeenCalledWith({ installer_id: TENANT_ID, id: DASHBOARD_ID });
    expect(result).toBe(1);
  });
});

// ── updateLayout() ────────────────────────────────────────────────────────────

describe('dashboardsModel.updateLayout()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('stringifies layout and stores it', async () => {
    const layout = { widgets: [{ id: 'w1', type: 'chart' }], gridConfig: { cols: 12 } };
    const updated = makeDashboard({ layout: JSON.stringify(layout) });
    const chain = {
      where: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnValue({
        then: jest.fn((cb) => Promise.resolve(cb([updated]))),
      }),
    };
    const trx = jest.fn(() => chain);
    trx.fn = { now: jest.fn(() => 'NOW()') };
    withTenant.mockImplementation(async (tid, cb) => cb(trx));

    const result = await dashboardsModel.updateLayout(TENANT_ID, OWNER_ID, DASHBOARD_ID, layout);

    // update() was called with JSON-stringified layout
    const updateArg = chain.update.mock.calls[0][0];
    expect(updateArg.layout).toBe(JSON.stringify(layout));
    expect(result).toEqual(updated);
  });
});

// ── addClient() ───────────────────────────────────────────────────────────────

describe('dashboardsModel.addClient()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('inserts into dashboard_clients and returns the row', async () => {
    const shareRow = { id: 'share-1', dashboard_id: DASHBOARD_ID, client_id: CLIENT_ID };
    const chain = {
      insert: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnValue({
        then: jest.fn((cb) => Promise.resolve(cb([shareRow]))),
      }),
    };
    const trx = jest.fn(() => chain);
    withTenant.mockImplementation(async (tid, cb) => cb(trx));

    const result = await dashboardsModel.addClient(TENANT_ID, DASHBOARD_ID, CLIENT_ID);

    expect(trx).toHaveBeenCalledWith('dashboard_clients');
    expect(chain.insert).toHaveBeenCalledWith({ dashboard_id: DASHBOARD_ID, client_id: CLIENT_ID });
    expect(result).toEqual(shareRow);
  });
});

// ── removeClient() ────────────────────────────────────────────────────────────

describe('dashboardsModel.removeClient()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes by dashboard_id and client_id', async () => {
    const chain = {
      where: jest.fn().mockReturnThis(),
      delete: jest.fn().mockResolvedValue(1),
    };
    const trx = jest.fn(() => chain);
    withTenant.mockImplementation(async (tid, cb) => cb(trx));

    const result = await dashboardsModel.removeClient(TENANT_ID, DASHBOARD_ID, CLIENT_ID);

    expect(chain.where).toHaveBeenCalledWith({ dashboard_id: DASHBOARD_ID, client_id: CLIENT_ID });
    expect(result).toBe(1);
  });
});

// ── findClientsByDashboard() ──────────────────────────────────────────────────

describe('dashboardsModel.findClientsByDashboard()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('joins clients table and filters by dashboard_id', async () => {
    const clients = [{ id: CLIENT_ID, name: 'Acme Corp', shared_at: new Date() }];
    const chain = {
      join: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue(clients),
    };
    const trx = jest.fn(() => chain);
    withTenant.mockImplementation(async (tid, cb) => cb(trx));

    const result = await dashboardsModel.findClientsByDashboard(TENANT_ID, DASHBOARD_ID);

    expect(trx).toHaveBeenCalledWith('dashboard_clients');
    expect(chain.join).toHaveBeenCalledWith('clients', 'clients.id', 'dashboard_clients.client_id');
    expect(chain.where).toHaveBeenCalledWith({ 'dashboard_clients.dashboard_id': DASHBOARD_ID });
    expect(result).toEqual(clients);
  });
});
