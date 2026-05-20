'use strict';

/**
 * Unit tests for device-templates.service.js
 *
 * Tests cover:
 * - validateDatastreams() pure helper
 * - create() with datastreams validation
 * - update() with datastreams validation
 *
 * All external dependencies (knex, model) are mocked.
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../device-templates.model');
const templatesModel = require('../device-templates.model');

jest.mock('../../../shared/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { validateDatastreams } = require('../device-templates.service');
const { UnprocessableEntityError } = require('../../../shared/errors');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDatastream(overrides = {}) {
  return {
    key: 'temperature',
    name: 'Temperature',
    type: 'number',
    direction: 'input',
    ...overrides,
  };
}

// ─── validateDatastreams() ────────────────────────────────────────────────────

describe('validateDatastreams()', () => {
  it('returns undefined for an empty array (no datastreams defined)', () => {
    expect(() => validateDatastreams([])).not.toThrow();
  });

  it('accepts a valid datastreams array with all required fields', () => {
    const datastreams = [
      makeDatastream({ key: 'temperature', type: 'number', direction: 'input' }),
      makeDatastream({ key: 'status', name: 'Status', type: 'string', direction: 'output' }),
    ];
    expect(() => validateDatastreams(datastreams)).not.toThrow();
  });

  it('throws UnprocessableEntityError with datastreams.field.required when key is missing', () => {
    const datastreams = [makeDatastream({ key: undefined })];
    expect(() => validateDatastreams(datastreams)).toThrow(UnprocessableEntityError);
    expect(() => validateDatastreams(datastreams)).toThrow('datastreams.field.required');
  });

  it('throws UnprocessableEntityError with datastreams.field.required when name is missing', () => {
    const datastreams = [makeDatastream({ name: undefined })];
    expect(() => validateDatastreams(datastreams)).toThrow('datastreams.field.required');
  });

  it('throws UnprocessableEntityError with datastreams.field.required when type is missing', () => {
    const datastreams = [makeDatastream({ type: undefined })];
    expect(() => validateDatastreams(datastreams)).toThrow('datastreams.field.required');
  });

  it('throws UnprocessableEntityError with datastreams.field.required when direction is missing', () => {
    const datastreams = [makeDatastream({ direction: undefined })];
    expect(() => validateDatastreams(datastreams)).toThrow('datastreams.field.required');
  });

  it('throws UnprocessableEntityError with datastreams.type.invalid for unknown type', () => {
    const datastreams = [makeDatastream({ type: 'object' })];
    expect(() => validateDatastreams(datastreams)).toThrow('datastreams.type.invalid');
  });

  it('throws UnprocessableEntityError with datastreams.direction.invalid for unknown direction', () => {
    const datastreams = [makeDatastream({ direction: 'unknown' })];
    expect(() => validateDatastreams(datastreams)).toThrow('datastreams.direction.invalid');
  });

  it('throws UnprocessableEntityError with datastreams.key.duplicate when two entries share the same key', () => {
    const datastreams = [
      makeDatastream({ key: 'temperature' }),
      makeDatastream({ key: 'temperature', name: 'Temp 2' }),
    ];
    expect(() => validateDatastreams(datastreams)).toThrow('datastreams.key.duplicate');
  });

  it('accepts all valid types: number, string, boolean, json', () => {
    const types = ['number', 'string', 'boolean', 'json'];
    types.forEach((type, i) => {
      const datastreams = [makeDatastream({ key: `key_${i}`, type })];
      expect(() => validateDatastreams(datastreams)).not.toThrow();
    });
  });

  it('accepts all valid directions: input, output, config', () => {
    const directions = ['input', 'output', 'config'];
    directions.forEach((direction, i) => {
      const datastreams = [makeDatastream({ key: `key_${i}`, direction })];
      expect(() => validateDatastreams(datastreams)).not.toThrow();
    });
  });

  it('accepts optional unit field without throwing', () => {
    const datastreams = [makeDatastream({ unit: '°C' })];
    expect(() => validateDatastreams(datastreams)).not.toThrow();
  });
});

// ─── create() ────────────────────────────────────────────────────────────────

const deviceTemplatesService = require('../device-templates.service');
const TENANT_ID = 'tenant-uuid-1';

function makeTemplateRow(overrides = {}) {
  return {
    id: 'tmpl-uuid-1',
    tenant_id: TENANT_ID,
    name: 'My Template',
    description: null,
    schema: {},
    datastreams: [],
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('deviceTemplatesService.create()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    templatesModel.insert.mockResolvedValue(makeTemplateRow());
  });

  it('creates a template with valid datastreams and persists them', async () => {
    const datastreams = [makeDatastream()];
    const result = await deviceTemplatesService.create(TENANT_ID, {
      name: 'Sensor Template',
      datastreams,
    });

    expect(templatesModel.insert).toHaveBeenCalledWith(expect.objectContaining({ datastreams }));
    expect(result).toMatchObject({ id: 'tmpl-uuid-1' });
  });

  it('defaults datastreams to empty array when not provided', async () => {
    await deviceTemplatesService.create(TENANT_ID, { name: 'Basic Template' });

    expect(templatesModel.insert).toHaveBeenCalledWith(
      expect.objectContaining({ datastreams: [] })
    );
  });

  it('throws UnprocessableEntityError with datastreams.key.duplicate for duplicate keys', async () => {
    const datastreams = [
      makeDatastream({ key: 'temp' }),
      makeDatastream({ key: 'temp', name: 'Temp 2' }),
    ];

    await expect(
      deviceTemplatesService.create(TENANT_ID, { name: 'Bad Template', datastreams })
    ).rejects.toThrow('datastreams.key.duplicate');

    expect(templatesModel.insert).not.toHaveBeenCalled();
  });

  it('throws UnprocessableEntityError with datastreams.field.required when datastream is missing direction', async () => {
    const datastreams = [makeDatastream({ direction: undefined })];

    await expect(
      deviceTemplatesService.create(TENANT_ID, { name: 'Bad Template', datastreams })
    ).rejects.toThrow('datastreams.field.required');

    expect(templatesModel.insert).not.toHaveBeenCalled();
  });
});

// ─── update() ────────────────────────────────────────────────────────────────

describe('deviceTemplatesService.update()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    templatesModel.findById.mockResolvedValue(makeTemplateRow());
    templatesModel.update.mockResolvedValue(makeTemplateRow({ name: 'Updated' }));
  });

  it('updates a template with valid datastreams', async () => {
    const datastreams = [
      makeDatastream({ key: 'humidity', name: 'Humidity', type: 'number', direction: 'input' }),
    ];
    const result = await deviceTemplatesService.update(TENANT_ID, 'tmpl-uuid-1', {
      name: 'Updated',
      datastreams,
    });

    expect(templatesModel.update).toHaveBeenCalledWith(
      'tmpl-uuid-1',
      expect.objectContaining({ datastreams })
    );
    expect(result).toMatchObject({ name: 'Updated' });
  });

  it('throws UnprocessableEntityError when update contains invalid datastreams type', async () => {
    const datastreams = [makeDatastream({ type: 'array' })];

    await expect(
      deviceTemplatesService.update(TENANT_ID, 'tmpl-uuid-1', {
        name: 'Bad Update',
        datastreams,
      })
    ).rejects.toThrow('datastreams.type.invalid');

    expect(templatesModel.update).not.toHaveBeenCalled();
  });
});

// ─── transformTemplate driver field merging (A.4 - io-driver) ────────────────

describe('deviceTemplatesService list() — transformTemplate driver fields', () => {
  const TENANT = 'tenant-uuid-99';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('derives driver_name from schema.drivers into datastreams (DHT22)', async () => {
    templatesModel.findAll.mockResolvedValue([
      {
        id: 'tmpl-1',
        tenant_id: TENANT,
        name: 'DHT22 Template',
        description: null,
        schema: {
          sensors: [
            { key: 'temperature', name: 'Temperatura', type: 'number', unit: '°C' },
            { key: 'humidity', name: 'Humedad', type: 'number', unit: '%' },
          ],
          drivers: [{ model: 'DHT22', gpio: 32 }],
        },
        datastreams: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
    templatesModel.count.mockResolvedValue(1);

    const result = await deviceTemplatesService.list(TENANT);
    expect(result.data[0].datastreams[0].driver_name).toBe('DHT22');
    expect(result.data[0].datastreams[0].gpio).toBe(32);
  });

  it('derives driver fields including config from schema.drivers', async () => {
    templatesModel.findAll.mockResolvedValue([
      {
        id: 'tmpl-2',
        tenant_id: TENANT,
        name: 'BME280 Template',
        description: null,
        schema: {
          sensors: [{ key: 'temperature', name: 'Temp', type: 'number', unit: '°C' }],
          drivers: [{ model: 'BME280', i2c_addr: '0x76', config: { oversampling: 'x1' } }],
        },
        datastreams: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
    templatesModel.count.mockResolvedValue(1);

    const result = await deviceTemplatesService.list(TENANT);
    expect(result.data[0].datastreams[0].driver_name).toBe('BME280');
    expect(result.data[0].datastreams[0].i2c_addr).toBe('0x76');
    expect(result.data[0].datastreams[0].config).toEqual({ oversampling: 'x1' });
  });

  it('does not crash when schema.drivers is empty', async () => {
    templatesModel.findAll.mockResolvedValue([
      {
        id: 'tmpl-3',
        tenant_id: TENANT,
        name: 'No Drivers',
        description: null,
        schema: {
          sensors: [{ key: 't', name: 'T', type: 'number' }],
          drivers: [],
        },
        datastreams: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
    templatesModel.count.mockResolvedValue(1);

    const result = await deviceTemplatesService.list(TENANT);
    expect(result.data[0].datastreams).toBeDefined();
  });

  it('does not crash when schema has no drivers field at all', async () => {
    templatesModel.findAll.mockResolvedValue([
      {
        id: 'tmpl-4',
        tenant_id: TENANT,
        name: 'Legacy',
        description: null,
        schema: {
          sensors: [{ key: 't', name: 'T', type: 'number' }],
        },
        datastreams: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
    templatesModel.count.mockResolvedValue(1);

    const result = await deviceTemplatesService.list(TENANT);
    expect(result.data[0].datastreams).toBeDefined();
    expect(result.data[0].datastreams[0].driver_name).toBeUndefined();
  });
});
