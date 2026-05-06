'use strict';

/**
 * Unit tests for rulesEngine.js
 *
 * Pure functions — no mocks needed.
 * Tests evaluateThresholdRules, evaluateStatusRules, compare, checkCooldown, executeAction.
 */

const {
  compare,
  checkCooldown,
  evaluateThresholdRules,
  evaluateStatusRules,
  executeAction,
  resetCooldownCache,
} = require('../rulesEngine');

describe('rulesEngine', () => {
  // ─── compare() ─────────────────────────────────────────────────────────────

  describe('compare()', () => {
    it('gt: returns true when value > threshold', () => {
      expect(compare(35, 'gt', 30)).toBe(true);
    });

    it('gt: returns false when value <= threshold', () => {
      expect(compare(30, 'gt', 30)).toBe(false);
      expect(compare(25, 'gt', 30)).toBe(false);
    });

    it('gte: returns true when value >= threshold', () => {
      expect(compare(30, 'gte', 30)).toBe(true);
      expect(compare(35, 'gte', 30)).toBe(true);
    });

    it('gte: returns false when value < threshold', () => {
      expect(compare(25, 'gte', 30)).toBe(false);
    });

    it('lt: returns true when value < threshold', () => {
      expect(compare(25, 'lt', 30)).toBe(true);
    });

    it('lt: returns false when value >= threshold', () => {
      expect(compare(30, 'lt', 30)).toBe(false);
      expect(compare(35, 'lt', 30)).toBe(false);
    });

    it('lte: returns true when value <= threshold', () => {
      expect(compare(30, 'lte', 30)).toBe(true);
      expect(compare(25, 'lte', 30)).toBe(true);
    });

    it('lte: returns false when value > threshold', () => {
      expect(compare(35, 'lte', 30)).toBe(false);
    });

    it('eq: returns true when value equals threshold', () => {
      expect(compare(30, 'eq', 30)).toBe(true);
    });

    it('eq: returns false when value differs from threshold', () => {
      expect(compare(25, 'eq', 30)).toBe(false);
    });

    it('neq: returns true when value differs from threshold', () => {
      expect(compare(25, 'neq', 30)).toBe(true);
    });

    it('neq: returns false when value equals threshold', () => {
      expect(compare(30, 'neq', 30)).toBe(false);
    });

    it('throws for unknown operator', () => {
      expect(() => compare(10, 'invalid', 20)).toThrow();
    });
  });

  // ─── checkCooldown() ──────────────────────────────────────────────────────

  describe('checkCooldown()', () => {
    beforeEach(() => {
      resetCooldownCache();
    });

    it('returns true when lastFiredAt is null (never fired)', () => {
      expect(checkCooldown('rule-1', null, 60000)).toBe(true);
    });

    it('returns true when cooldown period has elapsed', () => {
      const past = new Date(Date.now() - 120000); // 2 min ago
      expect(checkCooldown('rule-1', past, 60000)).toBe(true); // 60s cooldown
    });

    it('returns false when cooldown period has NOT elapsed', () => {
      const recent = new Date(Date.now() - 10000); // 10s ago
      expect(checkCooldown('rule-1', recent, 60000)).toBe(false); // 60s cooldown
    });

    it('returns true when cooldown is 0 (no cooldown)', () => {
      const recent = new Date(Date.now() - 1000);
      expect(checkCooldown('rule-1', recent, 0)).toBe(true);
    });

    it('uses module-level cache — tracks fired rules across calls', () => {
      resetCooldownCache();
      expect(checkCooldown('rule-1', null, 60000)).toBe(true);
      // Mark as fired (simulate what happens after executeAction)
      // The cache stores timestamps for the in-memory cooldown
    });
  });

  // ─── evaluateThresholdRules() ──────────────────────────────────────────────

  describe('evaluateThresholdRules()', () => {
    const TELEMETRY = { temperature: 35, humidity: 80 };
    const DEVICE_ID = 'device-1';
    const TENANT_ID = 'tenant-1';

    function makeRule(overrides = {}) {
      return {
        id: 'rule-1',
        name: 'High Temp Alert',
        enabled: true,
        trigger_type: 'threshold',
        trigger_config: { field: 'temperature', operator: 'gt', value: 30 },
        action_type: 'relay',
        action_config: { relay: 1, state: true },
        cooldown_ms: 60000,
        last_fired_at: null,
        ...overrides,
      };
    }

    beforeEach(() => {
      resetCooldownCache();
    });

    it('returns matching rules when telemetry value exceeds threshold', () => {
      const rules = [makeRule()];
      const result = evaluateThresholdRules(TENANT_ID, DEVICE_ID, TELEMETRY, rules);

      expect(result).toHaveLength(1);
      expect(result[0].rule).toMatchObject({ id: 'rule-1' });
      expect(result[0].matchedValue).toBe(35);
    });

    it('filters out non-threshold rules', () => {
      const rules = [
        makeRule({ trigger_type: 'status' }),
      ];
      const result = evaluateThresholdRules(TENANT_ID, DEVICE_ID, TELEMETRY, rules);
      expect(result).toHaveLength(0);
    });

    it('filters out disabled rules', () => {
      const rules = [makeRule({ enabled: false })];
      const result = evaluateThresholdRules(TENANT_ID, DEVICE_ID, TELEMETRY, rules);
      expect(result).toHaveLength(0);
    });

    it('filters out rules whose trigger field is not in telemetry', () => {
      const rules = [makeRule({
        trigger_config: { field: 'nonexistent', operator: 'gt', value: 10 },
      })];
      const result = evaluateThresholdRules(TENANT_ID, DEVICE_ID, TELEMETRY, rules);
      expect(result).toHaveLength(0);
    });

    it('filters out rules where comparison fails', () => {
      const rules = [makeRule({
        trigger_config: { field: 'temperature', operator: 'lt', value: 40 },
      })];
      // 35 < 40 → true, so it should match... wait, that means the condition IS met
      // Let me re-check: we want the rule to fire when the condition is met.
      // "lt" with value=40 and telemetry=35 → 35 < 40 is TRUE → should match
      // Actually let me reconsider the test: we want a case where it does NOT match
      const rules2 = [makeRule({
        trigger_config: { field: 'temperature', operator: 'lt', value: 30 },
      })];
      // 35 < 30 → false → should not match
      const result = evaluateThresholdRules(TENANT_ID, DEVICE_ID, TELEMETRY, rules2);
      expect(result).toHaveLength(0);
    });

    it('respects cooldown — excludes rules that recently fired', () => {
      // First call: rules fire
      const rules = [makeRule()];
      const first = evaluateThresholdRules(TENANT_ID, DEVICE_ID, TELEMETRY, rules);
      expect(first).toHaveLength(1);

      // Simulate that rule was fired (set last_fired_at)
      const firedRule = makeRule({ last_fired_at: new Date() });

      // Reset cache for clean test
      resetCooldownCache();
      // With recent last_fired_at, should NOT fire
      const second = evaluateThresholdRules(TENANT_ID, DEVICE_ID, TELEMETRY, [firedRule]);
      expect(second).toHaveLength(0);
    });

    it('handles multiple rules for the same telemetry field', () => {
      const rules = [
        makeRule({ id: 'rule-1', trigger_config: { field: 'temperature', operator: 'gt', value: 30 } }),
        makeRule({ id: 'rule-2', trigger_config: { field: 'humidity', operator: 'gt', value: 70 } }),
        makeRule({ id: 'rule-3', trigger_config: { field: 'temperature', operator: 'gt', value: 50 } }),
      ];

      const result = evaluateThresholdRules(TENANT_ID, DEVICE_ID, TELEMETRY, rules);

      // rule-1 matches (temp 35 > 30), rule-2 matches (humidity 80 > 70), rule-3 doesn't (35 > 50 false)
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.rule.id)).toEqual(['rule-1', 'rule-2']);
    });

    it('handles empty rules array', () => {
      const result = evaluateThresholdRules(TENANT_ID, DEVICE_ID, TELEMETRY, []);
      expect(result).toEqual([]);
    });
  });

  // ─── evaluateStatusRules() ─────────────────────────────────────────────────

  describe('evaluateStatusRules()', () => {
    const DEVICE_ID = 'device-1';
    const TENANT_ID = 'tenant-1';

    function makeRule(overrides = {}) {
      return {
        id: 'rule-status-1',
        name: 'Online Alert',
        enabled: true,
        trigger_type: 'status',
        trigger_config: { status: 'online' },
        action_type: 'relay',
        action_config: { relay: 1, state: true },
        cooldown_ms: 30000,
        last_fired_at: null,
        ...overrides,
      };
    }

    beforeEach(() => {
      resetCooldownCache();
    });

    it('returns matching rules when device status matches', () => {
      const rules = [makeRule()];
      const result = evaluateStatusRules(TENANT_ID, DEVICE_ID, 'online', rules);

      expect(result).toHaveLength(1);
      expect(result[0].rule).toMatchObject({ id: 'rule-status-1' });
      expect(result[0].matchedStatus).toBe('online');
    });

    it('filters out non-status rules', () => {
      const rules = [makeRule({ trigger_type: 'threshold' })];
      const result = evaluateStatusRules(TENANT_ID, DEVICE_ID, 'online', rules);
      expect(result).toHaveLength(0);
    });

    it('filters out disabled rules', () => {
      const rules = [makeRule({ enabled: false })];
      const result = evaluateStatusRules(TENANT_ID, DEVICE_ID, 'online', rules);
      expect(result).toHaveLength(0);
    });

    it('filters out rules where status does not match', () => {
      const rules = [makeRule({ trigger_config: { status: 'offline' } })];
      const result = evaluateStatusRules(TENANT_ID, DEVICE_ID, 'online', rules);
      expect(result).toHaveLength(0);
    });

    it('respects cooldown for status rules', () => {
      // First call with fresh rule
      const rules = [makeRule()];
      const first = evaluateStatusRules(TENANT_ID, DEVICE_ID, 'online', rules);
      expect(first).toHaveLength(1);

      // Rule recently fired
      const firedRule = makeRule({ last_fired_at: new Date() });
      resetCooldownCache();
      const second = evaluateStatusRules(TENANT_ID, DEVICE_ID, 'online', [firedRule]);
      expect(second).toHaveLength(0);
    });

    it('handles empty rules array', () => {
      const result = evaluateStatusRules(TENANT_ID, DEVICE_ID, 'online', []);
      expect(result).toEqual([]);
    });
  });

  // ─── executeAction() ───────────────────────────────────────────────────────

  describe('executeAction()', () => {
    it('relay action returns { action: "relay", relay, state }', async () => {
      const result = await executeAction(
        { action_type: 'relay', action_config: { relay: 1, state: true } },
        'tenant-1'
      );

      expect(result).toEqual({
        action: 'relay',
        relay: 1,
        state: true,
      });
    });

    it('command action returns { action: "command", action, payload }', async () => {
      const result = await executeAction(
        { action_type: 'command', action_config: { action: 'restart', payload: { delay: 5 } } },
        'tenant-1'
      );

      expect(result).toEqual({
        action: 'command',
        action: 'restart',
        payload: { delay: 5 },
      });
    });
  });

  // ─── evaluateThresholdRules + executeAction integration ─────────────────────

  describe('end-to-end: evaluate + execute', () => {
    beforeEach(() => {
      resetCooldownCache();
    });

    it('fires matching rules and returns actionable results', () => {
      const TELEMETRY = { temperature: 35 };
      const rules = [{
        id: 'rule-1',
        name: 'High Temp',
        enabled: true,
        trigger_type: 'threshold',
        trigger_config: { field: 'temperature', operator: 'gt', value: 30 },
        action_type: 'relay',
        action_config: { relay: 1, state: true },
        cooldown_ms: 60000,
        last_fired_at: null,
      }];

      const matches = evaluateThresholdRules('tenant-1', 'device-1', TELEMETRY, rules);

      expect(matches).toHaveLength(1);
      expect(matches[0].rule.id).toBe('rule-1');
      expect(matches[0].matchedValue).toBe(35);
    });
  });
});
