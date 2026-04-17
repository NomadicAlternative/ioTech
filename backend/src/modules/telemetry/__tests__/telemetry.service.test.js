'use strict';

/**
 * Unit tests for telemetry.service.js
 *
 * All external dependencies (knex db, telemetry.model) are mocked so
 * these tests run without a real database.
 */

// ─── Mock: telemetry.model ───────────────────────────────────────────────────
jest.mock('../telemetry.model');
const telemetryModel = require('../telemetry.model');

// ─── Mock: shared/db/knex ─────────────────────────────────────────────────────
// telemetry.service uses db directly for device lookups (outside withTenant)
//
// NOTE: jest.mock() is hoisted by Jest — factory must not reference module-scope
// variables declared with const/let (TDZ). Build the mocks inside the factory
// and expose them via properties so beforeAll can wire up the module-level refs.

let mockFirst;
let chainableMock;
let mockDb;

jest.mock('../../../shared/db/knex', () => {
  const _mockFirst = jest.fn();
  const _mockUpdate = jest.fn();
  const _chainable = {
    where: jest.fn().mockReturnThis(),
    first: _mockFirst,
    update: _mockUpdate,
  };
  const _db = jest.fn(() => _chainable);

  _db.__mockFirst = _mockFirst;
  _db.__mockUpdate = _mockUpdate;
  _db.__chainable = _chainable;

  return _db;
});

// ─── Mock: logger ─────────────────────────────────────────────────────────────
jest.mock('../../../shared/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const telemetryService = require('../telemetry.service');
const { ValidationError, NotFoundError } = require('../../../shared/errors');

// ─── Wire up mock references (must run after require, before tests) ───────────
beforeAll(() => {
  mockDb = require('../../../shared/db/knex');
  chainableMock = mockDb.__chainable;
  mockFirst = mockDb.__mockFirst;
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-1';
const DEVICE_ID = 'device-uuid-1';

function makeDevice(overrides = {}) {
  return {
    id: DEVICE_ID,
    tenant_id: TENANT_ID,
    name: 'Test Device',
    status: 'active',
    device_token: 'tok-abc-123',
    ...overrides,
  };
}

function makeTelemetryRow(overrides = {}) {
  return {
    id: 'tel-uuid-1',
    device_id: DEVICE_ID,
    tenant_id: TENANT_ID,
    data: { temperature: 25.3 },
    received_at: new Date(),
    ...overrides,
  };
}

// ─── ingest() ────────────────────────────────────────────────────────────────

describe('telemetryService.ingest()', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the chainable mock for update
    chainableMock.where.mockReturnThis();
    chainableMock.update.mockResolvedValue(1);

    // Default: device exists and is active
    mockFirst.mockResolvedValue(makeDevice());
    telemetryModel.insert.mockResolvedValue(makeTelemetryRow());
  });

  it('persists telemetry and updates last_seen when device is known and active', async () => {
    const payload = { temperature: 25.3, humidity: 60 };
    const receivedAt = new Date();

    const result = await telemetryService.ingest(TENANT_ID, DEVICE_ID, payload, receivedAt);

    // Device lookup should have happened
    expect(mockDb).toHaveBeenCalledWith('devices');

    // Telemetry model insert should have been called
    expect(telemetryModel.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: DEVICE_ID,
        data: payload,
        receivedAt,
      })
    );

    expect(result).toMatchObject({
      device_id: DEVICE_ID,
      tenant_id: TENANT_ID,
    });
  });

  it('returns null (silent drop) when device is unknown or inactive', async () => {
    // Device not found → null
    mockFirst.mockResolvedValue(null);

    const result = await telemetryService.ingest(TENANT_ID, DEVICE_ID, { temp: 20 });

    expect(result).toBeNull();
    expect(telemetryModel.insert).not.toHaveBeenCalled();
  });

  it('throws ValidationError when deviceId is missing', async () => {
    await expect(
      telemetryService.ingest(TENANT_ID, undefined, { temp: 20 })
    ).rejects.toThrow(ValidationError);

    expect(mockDb).not.toHaveBeenCalled();
    expect(telemetryModel.insert).not.toHaveBeenCalled();
  });

  it('uses device.tenant_id as fallback when tenantId argument is not provided', async () => {
    const result = await telemetryService.ingest(null, DEVICE_ID, { temp: 18 });

    expect(telemetryModel.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID, // from device.tenant_id
      })
    );
    expect(result).not.toBeNull();
  });
});

// ─── ingest() — datastream validation ────────────────────────────────────────

describe('telemetryService.ingest() — datastream validation', () => {
  const logger = require('../../../shared/logger');

  function makeTemplate(datastreamOverrides = []) {
    return {
      id: 'tmpl-uuid-1',
      tenant_id: TENANT_ID,
      name: 'Sensor Template',
      datastreams: datastreamOverrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    chainableMock.where.mockReturnThis();
    chainableMock.update.mockResolvedValue(1);
    telemetryModel.insert.mockResolvedValue(makeTelemetryRow());
  });

  it('accepts valid payload that matches template datastreams (number type)', async () => {
    const device = makeDevice({ template_id: 'tmpl-uuid-1' });
    const template = makeTemplate([
      { key: 'temperature', name: 'Temperature', type: 'number', direction: 'input' },
    ]);

    // First call → device, second call → template
    mockFirst.mockResolvedValueOnce(device).mockResolvedValueOnce(template);

    const result = await telemetryService.ingest(TENANT_ID, DEVICE_ID, { temperature: 25.3 });

    expect(result).not.toBeNull();
    expect(telemetryModel.insert).toHaveBeenCalled();
  });

  it('drops payload and logs warning on type mismatch (number key received string)', async () => {
    const device = makeDevice({ template_id: 'tmpl-uuid-1' });
    const template = makeTemplate([
      { key: 'temperature', name: 'Temperature', type: 'number', direction: 'input' },
    ]);

    mockFirst.mockResolvedValueOnce(device).mockResolvedValueOnce(template);

    const result = await telemetryService.ingest(TENANT_ID, DEVICE_ID, { temperature: 'hot' });

    expect(result).toBeNull();
    expect(telemetryModel.insert).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('telemetry.type_mismatch'),
      expect.objectContaining({ device_id: DEVICE_ID, key: 'temperature' })
    );
  });

  it('ignores unknown keys silently — does NOT drop the message', async () => {
    const device = makeDevice({ template_id: 'tmpl-uuid-1' });
    const template = makeTemplate([
      { key: 'temperature', name: 'Temperature', type: 'number', direction: 'input' },
    ]);

    mockFirst.mockResolvedValueOnce(device).mockResolvedValueOnce(template);

    // 'rssi' is not in the template datastreams → should be ignored
    const result = await telemetryService.ingest(TENANT_ID, DEVICE_ID, {
      temperature: 22.0,
      rssi: -70,
    });

    expect(result).not.toBeNull();
    expect(telemetryModel.insert).toHaveBeenCalled();
  });

  it('ignores output direction keys — treats them as unknown (not validated)', async () => {
    const device = makeDevice({ template_id: 'tmpl-uuid-1' });
    const template = makeTemplate([
      { key: 'temperature', name: 'Temperature', type: 'number', direction: 'input' },
      { key: 'setpoint', name: 'Setpoint', type: 'number', direction: 'output' },
    ]);

    mockFirst.mockResolvedValueOnce(device).mockResolvedValueOnce(template);

    // setpoint is output direction — ignore type check, accept message
    const result = await telemetryService.ingest(TENANT_ID, DEVICE_ID, {
      temperature: 22.0,
      setpoint: 'wrong_type_but_output_direction',
    });

    expect(result).not.toBeNull();
    expect(telemetryModel.insert).toHaveBeenCalled();
  });

  it('skips validation and logs warning when template has no datastreams (legacy)', async () => {
    const device = makeDevice({ template_id: 'tmpl-uuid-1' });
    const template = makeTemplate([]); // empty datastreams array

    mockFirst.mockResolvedValueOnce(device).mockResolvedValueOnce(template);

    const result = await telemetryService.ingest(TENANT_ID, DEVICE_ID, { anything: 'here' });

    expect(result).not.toBeNull();
    expect(telemetryModel.insert).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('unvalidated'),
      expect.objectContaining({ device_id: DEVICE_ID })
    );
  });

  it('skips validation when device has no template_id', async () => {
    const device = makeDevice({ template_id: null });
    mockFirst.mockResolvedValueOnce(device);

    const result = await telemetryService.ingest(TENANT_ID, DEVICE_ID, { anything: 'here' });

    expect(result).not.toBeNull();
    expect(telemetryModel.insert).toHaveBeenCalled();
  });
});

// ─── query() ─────────────────────────────────────────────────────────────────

describe('telemetryService.query()', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    chainableMock.where.mockReturnThis();
    // Default: device exists for this tenant
    mockFirst.mockResolvedValue(makeDevice());
    telemetryModel.findByDevice.mockResolvedValue([makeTelemetryRow()]);
  });

  it('returns telemetry data for a valid device within the tenant', async () => {
    const result = await telemetryService.query(TENANT_ID, DEVICE_ID);

    expect(mockDb).toHaveBeenCalledWith('devices');
    expect(telemetryModel.findByDevice).toHaveBeenCalledWith(TENANT_ID, DEVICE_ID, {});
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ device_id: DEVICE_ID });
  });

  it('throws NotFoundError when device does not belong to the tenant', async () => {
    mockFirst.mockResolvedValue(null);

    await expect(
      telemetryService.query(TENANT_ID, DEVICE_ID)
    ).rejects.toThrow(NotFoundError);

    expect(telemetryModel.findByDevice).not.toHaveBeenCalled();
  });

  it('throws ValidationError when deviceId is missing', async () => {
    await expect(
      telemetryService.query(TENANT_ID, undefined)
    ).rejects.toThrow(ValidationError);
  });

  it('passes through opts (from/to/limit) to the model', async () => {
    const opts = { from: '2026-01-01', to: '2026-01-31', limit: 50 };

    await telemetryService.query(TENANT_ID, DEVICE_ID, opts);

    expect(telemetryModel.findByDevice).toHaveBeenCalledWith(TENANT_ID, DEVICE_ID, opts);
  });
});
