'use strict';

/**
 * Unit tests for rules.model.js
 *
 * All DB dependencies (knex, withTenant) are mocked so tests focus on
 * query building patterns and data transformation.
 */

jest.mock('../../../shared/db/knex');
jest.mock('../../../shared/db/tenant-knex');

const knex = require('../../../shared/db/knex');
const { withTenant } = require('../../../shared/db/tenant-knex');
const rulesModel = require('../rules.model');

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
    action_config: { relay: 1, state: 'on' },
    cooldown_ms: 60000,
    last_fired_at: null,
    created_at: new Date('2025-01-01T00:00:00Z'),
    updated_at: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

/**
 * Build a trx function that acts like a Knex transaction.
 * When called as trx('rules'), returns a chainable query builder.
 */
function buildTrx({ firstResult, insertResult, updateResult, deleteResult } = {}) {
  const chainable = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(firstResult !== undefined ? firstResult : makeRuleRow()),
    insert: jest.fn().mockResolvedValue(
      insertResult !== undefined ? insertResult : [makeRuleRow()]
    ),
    update: jest.fn().mockResolvedValue(
      updateResult !== undefined ? updateResult : [makeRuleRow()]
    ),
    delete: jest.fn().mockResolvedValue(deleteResult !== undefined ? deleteResult : 1),
    returning: jest.fn().mockReturnThis(),
    then: undefined,
  };

  // trx is a function so trx('rules') works
  const trx = jest.fn(() => chainable);
  // Expose chainable for direct reference in tests
  trx.__chainable = chainable;

  return trx;
}

describe('rules.model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── findAll() ─────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('queries rules table scoped to tenant_id and strips tenant_id from results', async () => {
      withTenant.mockImplementation(async (_tid, cb) => {
        const trx = buildTrx();
        return cb(trx);
      });

      // Make findById return a row so the .then() in findAll resolves via the
      // Promise chain properly
      withTenant.mockResolvedValue([makeRuleRow()]);

      const result = await rulesModel.findAll(TENANT_ID);

      expect(withTenant).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
      // withTenant returns [row], .map(stripTenantId) runs — tenant_id is gone
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).not.toHaveProperty('tenant_id');
      }
    });

    it('returns empty array when no rules exist', async () => {
      withTenant.mockResolvedValue([]);

      const result = await rulesModel.findAll(TENANT_ID);
      expect(result).toEqual([]);
    });

    it('accepts optional pagination', async () => {
      withTenant.mockResolvedValue([makeRuleRow()]);

      const result = await rulesModel.findAll(TENANT_ID, { page: 1, limit: 10 });
      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('tenant_id');
    });
  });

  // ─── findById() ────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns the rule when found', async () => {
      withTenant.mockResolvedValue(makeRuleRow());

      const result = await rulesModel.findById(TENANT_ID, RULE_ID);

      expect(withTenant).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
      expect(result).toMatchObject({ id: RULE_ID });
      expect(result).not.toHaveProperty('tenant_id');
    });

    it('returns undefined when rule not found', async () => {
      withTenant.mockResolvedValue(undefined);

      const result = await rulesModel.findById(TENANT_ID, 'nonexistent-id');
      expect(result).toBeUndefined();
    });
  });

  // ─── insert() ──────────────────────────────────────────────────────────────

  describe('insert()', () => {
    it('inserts data and returns created row without tenant_id', async () => {
      withTenant.mockResolvedValue(makeRuleRow());

      const data = {
        id: RULE_ID,
        tenant_id: TENANT_ID,
        name: 'Test Rule',
        trigger_type: 'threshold',
        trigger_config: { field: 'temp', operator: 'gt', value: 25 },
        action_type: 'relay',
        action_config: { relay: 1, state: 'on' },
        cooldown_ms: 30000,
      };

      const result = await rulesModel.insert(data);

      expect(result).toMatchObject({ id: RULE_ID });
      expect(result).not.toHaveProperty('tenant_id');
    });
  });

  // ─── update() ──────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('updates by id and returns updated row without tenant_id', async () => {
      withTenant.mockResolvedValue(makeRuleRow({ name: 'Updated Rule' }));

      const result = await rulesModel.update(RULE_ID, { name: 'Updated Rule' });

      expect(result).toMatchObject({ id: RULE_ID, name: 'Updated Rule' });
      expect(result).not.toHaveProperty('tenant_id');
    });
  });

  // ─── remove() ──────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('deletes by id and returns count of deleted rows', async () => {
      knex.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        delete: jest.fn().mockResolvedValue(1),
      }));

      const result = await rulesModel.remove(RULE_ID);
      expect(result).toBe(1);
    });
  });

  // ─── updateLastFired() ─────────────────────────────────────────────────────

  describe('updateLastFired()', () => {
    it('updates last_fired_at for a rule by id and strips tenant_id', async () => {
      withTenant.mockResolvedValue(makeRuleRow({ last_fired_at: new Date() }));

      const now = new Date();
      const result = await rulesModel.updateLastFired(RULE_ID, now);

      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('tenant_id');
      expect(result.last_fired_at).toBeDefined();
    });
  });
});
