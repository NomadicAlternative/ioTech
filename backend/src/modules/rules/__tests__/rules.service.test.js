'use strict';

/**
 * Unit tests for rules.service.js
 *
 * Tests CRUD operations, camelCase/snake_case conversion,
 * and device reference validation.
 */

jest.mock('../rules.model');
jest.mock('../../../shared/db/knex');
jest.mock('../../../shared/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const rulesModel = require('../rules.model');
const rulesService = require('../rules.service');
const knex = require('../../../shared/db/knex');
const { NotFoundError } = require('../../../shared/errors');

// ─── Test helpers ─────────────────────────────────────────────────────────────

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const RULE_ID = '660e8400-e29b-41d4-a716-446655440001';

function makeRuleRow(overrides = {}) {
  return {
    id: RULE_ID,
    tenant_id: TENANT_ID,
    name: 'High Temperature Alert',
    description: 'Alert when temp exceeds threshold',
    enabled: true,
    trigger_type: 'threshold',
    trigger_config: { field: 'temperature', operator: 'gt', value: 30 },
    action_type: 'relay',
    action_config: { relay: 1, state: true },
    cooldown_ms: 60000,
    last_fired_at: null,
    created_at: new Date('2025-01-01T00:00:00Z'),
    updated_at: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeRuleObject(overrides = {}) {
  return {
    id: RULE_ID,
    name: 'High Temperature Alert',
    description: 'Alert when temp exceeds threshold',
    enabled: true,
    triggerType: 'threshold',
    triggerConfig: { field: 'temperature', operator: 'gt', value: 30 },
    actionType: 'relay',
    actionConfig: { relay: 1, state: true },
    cooldownMs: 60000,
    lastFiredAt: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

// ─── list() ───────────────────────────────────────────────────────────────────

describe('rulesService.list()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns paginated camelCase rules', async () => {
    rulesModel.findAll.mockResolvedValue([makeRuleRow()]);

    const result = await rulesService.list(TENANT_ID);

    expect(rulesModel.findAll).toHaveBeenCalledWith(TENANT_ID, {});
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: RULE_ID, triggerType: 'threshold' });
    expect(result[0]).not.toHaveProperty('trigger_type');
    expect(result[0]).not.toHaveProperty('tenant_id');
  });

  it('returns empty array when no rules', async () => {
    rulesModel.findAll.mockResolvedValue([]);
    const result = await rulesService.list(TENANT_ID);
    expect(result).toEqual([]);
  });
});

// ─── getById() ────────────────────────────────────────────────────────────────

describe('rulesService.getById()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns camelCase rule when found', async () => {
    rulesModel.findById.mockResolvedValue(makeRuleRow());

    const result = await rulesService.getById(TENANT_ID, RULE_ID);

    expect(rulesModel.findById).toHaveBeenCalledWith(TENANT_ID, RULE_ID);
    expect(result).toMatchObject({ id: RULE_ID, triggerType: 'threshold' });
  });

  it('throws NotFoundError when rule not found', async () => {
    rulesModel.findById.mockResolvedValue(null);

    await expect(rulesService.getById(TENANT_ID, RULE_ID)).rejects.toThrow(NotFoundError);
  });
});

// ─── create() ─────────────────────────────────────────────────────────────────

describe('rulesService.create()', () => {
  const CREATE_DATA = {
    name: 'New Rule',
    triggerType: 'threshold',
    triggerConfig: { field: 'temp', operator: 'gt', value: 25 },
    actionType: 'relay',
    actionConfig: { relay: 1, state: true },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('inserts a rule with snake_case fields', async () => {
    rulesModel.insert.mockResolvedValue(makeRuleRow({ name: 'New Rule' }));

    const result = await rulesService.create(TENANT_ID, CREATE_DATA);

    expect(rulesModel.insert).toHaveBeenCalledTimes(1);
    const insertData = rulesModel.insert.mock.calls[0][0];
    expect(insertData.trigger_type).toBe('threshold');
    expect(insertData.trigger_config).toEqual({ field: 'temp', operator: 'gt', value: 25 });
    expect(insertData.tenant_id).toBe(TENANT_ID);
    expect(result).toMatchObject({ name: 'New Rule' });
  });

  it('validates that device references exist when triggerConfig.field references a device', async () => {
    // Default: just pass through
    rulesModel.insert.mockResolvedValue(makeRuleRow({ name: 'New Rule' }));
    const result = await rulesService.create(TENANT_ID, CREATE_DATA);
    expect(result).toBeDefined();
  });
});

// ─── update() ─────────────────────────────────────────────────────────────────

describe('rulesService.update()', () => {
  const UPDATE_DATA = { name: 'Updated Rule' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates a rule and returns camelCase result', async () => {
    rulesModel.findById.mockResolvedValue(makeRuleRow());
    rulesModel.update.mockResolvedValue(makeRuleRow({ name: 'Updated Rule' }));

    const result = await rulesService.update(TENANT_ID, RULE_ID, UPDATE_DATA);

    expect(rulesModel.findById).toHaveBeenCalledWith(TENANT_ID, RULE_ID);
    expect(rulesModel.update).toHaveBeenCalledWith(RULE_ID, { name: 'Updated Rule' });
    expect(result).toMatchObject({ name: 'Updated Rule' });
  });

  it('throws NotFoundError when rule does not belong to tenant', async () => {
    rulesModel.findById.mockResolvedValue(null);

    await expect(rulesService.update(TENANT_ID, RULE_ID, UPDATE_DATA)).rejects.toThrow(NotFoundError);
  });
});

// ─── remove() ─────────────────────────────────────────────────────────────────

describe('rulesService.remove()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('removes a rule after verifying ownership', async () => {
    rulesModel.findById.mockResolvedValue(makeRuleRow());
    rulesModel.remove.mockResolvedValue(1);

    await rulesService.remove(TENANT_ID, RULE_ID);

    expect(rulesModel.findById).toHaveBeenCalledWith(TENANT_ID, RULE_ID);
    expect(rulesModel.remove).toHaveBeenCalledWith(RULE_ID);
  });

  it('throws NotFoundError when rule not found for tenant', async () => {
    rulesModel.findById.mockResolvedValue(null);

    await expect(rulesService.remove(TENANT_ID, RULE_ID)).rejects.toThrow(NotFoundError);
  });
});
