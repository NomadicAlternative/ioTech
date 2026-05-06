'use strict';

/**
 * Unit tests for rules.schemas.js
 *
 * Tests Joi validation schemas for create and update operations.
 * Focus on conditional validation rules based on trigger_type and action_type.
 */

const schemas = require('../rules.schemas');

describe('rules.schemas', () => {
  // ─── VALID OPERATORS ───────────────────────────────────────────────────────
  // gt, gte, lt, lte, eq, neq

  describe('create', () => {
    const MIN_CREATE = {
      name: 'Temp Alert',
      triggerType: 'threshold',
      triggerConfig: { field: 'temperature', operator: 'gt', value: 30 },
      actionType: 'relay',
      actionConfig: { relay: 1, state: true },
    };

    it('accepts a valid create payload', () => {
      const { error } = schemas.create.validate(MIN_CREATE);
      expect(error).toBeUndefined();
    });

    it('requires name', () => {
      const { error } = schemas.create.validate({ ...MIN_CREATE, name: undefined });
      expect(error).toBeDefined();
      expect(error.details[0].path[0]).toBe('name');
    });

    it('requires triggerType', () => {
      const { error } = schemas.create.validate({ ...MIN_CREATE, triggerType: undefined });
      expect(error).toBeDefined();
      expect(error.details[0].path[0]).toBe('triggerType');
    });

    it('rejects invalid triggerType', () => {
      const { error } = schemas.create.validate({ ...MIN_CREATE, triggerType: 'invalid' });
      expect(error).toBeDefined();
    });

    it('requires actionType', () => {
      const { error } = schemas.create.validate({ ...MIN_CREATE, actionType: undefined });
      expect(error).toBeDefined();
      expect(error.details[0].path[0]).toBe('actionType');
    });

    it('rejects invalid actionType', () => {
      const { error } = schemas.create.validate({ ...MIN_CREATE, actionType: 'invalid' });
      expect(error).toBeDefined();
    });

    // ── Conditional: trigger_type === 'threshold' ──────────────────────────────

    it('requires triggerConfig.field when triggerType is "threshold"', () => {
      const { error } = schemas.create.validate({
        ...MIN_CREATE,
        triggerConfig: { operator: 'gt', value: 30 },
      });
      expect(error).toBeDefined();
    });

    it('requires triggerConfig.operator when triggerType is "threshold"', () => {
      const { error } = schemas.create.validate({
        ...MIN_CREATE,
        triggerConfig: { field: 'temperature', value: 30 },
      });
      expect(error).toBeDefined();
    });

    it('requires triggerConfig.value when triggerType is "threshold"', () => {
      const { error } = schemas.create.validate({
        ...MIN_CREATE,
        triggerConfig: { field: 'temperature', operator: 'gt' },
      });
      expect(error).toBeDefined();
    });

    it('rejects invalid operator in triggerConfig for threshold', () => {
      const { error } = schemas.create.validate({
        ...MIN_CREATE,
        triggerConfig: { field: 'temp', operator: 'invalid', value: 30 },
      });
      expect(error).toBeDefined();
    });

    it('rejects non-numeric value in triggerConfig for threshold', () => {
      const { error } = schemas.create.validate({
        ...MIN_CREATE,
        triggerConfig: { field: 'temp', operator: 'gt', value: 'hot' },
      });
      expect(error).toBeDefined();
    });

    // ── Conditional: trigger_type === 'status' ────────────────────────────────

    it('requires triggerConfig.status when triggerType is "status"', () => {
      const { error } = schemas.create.validate({
        name: 'Status Alert',
        triggerType: 'status',
        triggerConfig: {},
        actionType: 'relay',
        actionConfig: { relay: 1, state: true },
      });
      expect(error).toBeDefined();
    });

    it('accepts triggerConfig.status when triggerType is "status"', () => {
      const { error } = schemas.create.validate({
        name: 'Status Alert',
        triggerType: 'status',
        triggerConfig: { status: 'online' },
        actionType: 'relay',
        actionConfig: { relay: 1, state: true },
      });
      expect(error).toBeUndefined();
    });

    // ── Conditional: action_type === 'relay' ───────────────────────────────────

    it('requires actionConfig.relay when actionType is "relay"', () => {
      const { error } = schemas.create.validate({
        ...MIN_CREATE,
        actionConfig: { state: true },
      });
      expect(error).toBeDefined();
    });

    it('requires actionConfig.state when actionType is "relay"', () => {
      const { error } = schemas.create.validate({
        ...MIN_CREATE,
        actionConfig: { relay: 1 },
      });
      expect(error).toBeDefined();
    });

    it('rejects relay < 1', () => {
      const { error } = schemas.create.validate({
        ...MIN_CREATE,
        actionConfig: { relay: 0, state: true },
      });
      expect(error).toBeDefined();
    });

    it('rejects relay > 8', () => {
      const { error } = schemas.create.validate({
        ...MIN_CREATE,
        actionConfig: { relay: 9, state: true },
      });
      expect(error).toBeDefined();
    });

    it('rejects invalid relay state (must be boolean)', () => {
      const { error } = schemas.create.validate({
        ...MIN_CREATE,
        actionConfig: { relay: 1, state: 'maybe' },
      });
      expect(error).toBeDefined();
    });

    // ── cooldown_ms ─────────────────────────────────────────────────────────

    it('accepts cooldown_ms as optional integer >= 0', () => {
      const { error } = schemas.create.validate({ ...MIN_CREATE, cooldownMs: 5000 });
      expect(error).toBeUndefined();
    });

    it('rejects negative cooldown_ms', () => {
      const { error } = schemas.create.validate({ ...MIN_CREATE, cooldownMs: -1 });
      expect(error).toBeDefined();
    });

    // ── description ──────────────────────────────────────────────────────────

    it('accepts description as optional string', () => {
      const { error } = schemas.create.validate({
        ...MIN_CREATE,
        description: 'Some description',
      });
      expect(error).toBeUndefined();
    });

    // ── enabled ──────────────────────────────────────────────────────────────

    it('accepts enabled as optional boolean', () => {
      const { error } = schemas.create.validate({ ...MIN_CREATE, enabled: false });
      expect(error).toBeUndefined();
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('accepts empty object (all optional)', () => {
      const { error } = schemas.update.validate({ name: undefined });
      // update schema uses .custom() but all fields are optional — no required fields
      const { error: emptyError } = schemas.update.validate({});
      expect(emptyError).toBeUndefined();
    });

    it('accepts partial update with name only', () => {
      const { error } = schemas.update.validate({ name: 'New Name' });
      expect(error).toBeUndefined();
    });

    it('rejects invalid triggerType', () => {
      const { error } = schemas.update.validate({ triggerType: 'bad' });
      expect(error).toBeDefined();
    });

    it('rejects invalid actionType', () => {
      const { error } = schemas.update.validate({ actionType: 'bad' });
      expect(error).toBeDefined();
    });

    it('validates triggerConfig conditionally when triggerType is changed to threshold', () => {
      const { error } = schemas.update.validate({
        triggerType: 'threshold',
        triggerConfig: { operator: 'gt', value: 30 },
      });
      expect(error).toBeDefined(); // missing field
    });

    it('validates actionConfig conditionally when actionType is changed to relay', () => {
      const { error } = schemas.update.validate({
        actionType: 'relay',
        actionConfig: { relay: 1 },
      });
      expect(error).toBeDefined(); // missing state
    });

    it('accepts valid update with relay action', () => {
      const { error } = schemas.update.validate({
        actionType: 'relay',
        actionConfig: { relay: 2, state: false },
      });
      expect(error).toBeUndefined();
    });
  });
});
