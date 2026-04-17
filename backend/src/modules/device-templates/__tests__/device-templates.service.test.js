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

    expect(templatesModel.insert).toHaveBeenCalledWith(
      expect.objectContaining({ datastreams })
    );
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
    const datastreams = [makeDatastream({ key: 'humidity', name: 'Humidity', type: 'number', direction: 'input' })];
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
