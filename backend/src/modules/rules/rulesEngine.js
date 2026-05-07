'use strict';

/**
 * Rules Engine — Pure evaluation logic for automation rules.
 *
 * This file contains only pure functions with NO database access.
 * Rules are passed in from the caller (service layer).
 *
 * In-memory cooldown cache tracks recent firings to avoid
 * repeated action execution during a single evaluation cycle.
 */

// ─── In-memory cooldown cache ─────────────────────────────────────────────────
// Tracks rule IDs that have been fired during the current evaluation cycle.
// Key: ruleId, Value: timestamp of when it was marked as fired.
const cooldownCache = new Map();

/**
 * Reset the in-memory cooldown cache.
 * Useful for testing and between evaluation cycles.
 */
function resetCooldownCache() {
  cooldownCache.clear();
}

// ─── compare() ────────────────────────────────────────────────────────────────

/**
 * Compare a value against a threshold using the given operator.
 * Pure function — no side effects.
 *
 * @param {number} value — the actual telemetry value
 * @param {string} operator — one of: gt, gte, lt, lte, eq, neq
 * @param {number} threshold — the threshold to compare against
 * @returns {boolean}
 */
function compare(value, operator, threshold) {
  switch (operator) {
    case 'gt':
      return value > threshold;
    case 'gte':
      return value >= threshold;
    case 'lt':
      return value < threshold;
    case 'lte':
      return value <= threshold;
    case 'eq':
      return value === threshold;
    case 'neq':
      return value !== threshold;
    default:
      throw new Error(`Unknown operator: ${operator}`);
  }
}

// ─── checkCooldown() ─────────────────────────────────────────────────────────

/**
 * Check if a rule can fire based on its cooldown period.
 * First checks the DB last_fired_at, then falls back to in-memory cache.
 *
 * @param {string} ruleId
 * @param {Date|null} lastFiredAt — from DB (null = never fired)
 * @param {number} cooldownMs — cooldown period in milliseconds
 * @returns {boolean} — true if the rule can fire
 */
function checkCooldown(ruleId, lastFiredAt, cooldownMs) {
  // If cooldown is 0, always allow
  if (!cooldownMs || cooldownMs <= 0) {
    return true;
  }

  const now = Date.now();

  // Check in-memory cache first (for same-cycle dedup)
  const cachedFiredAt = cooldownCache.get(ruleId);
  if (cachedFiredAt) {
    const elapsed = now - cachedFiredAt;
    if (elapsed < cooldownMs) {
      return false;
    }
  }

  // Check DB last_fired_at
  if (lastFiredAt) {
    const elapsed = now - new Date(lastFiredAt).getTime();
    if (elapsed < cooldownMs) {
      return false;
    }
  }

  return true;
}

/**
 * Mark a rule as fired in the in-memory cache.
 * Called after executeAction to prevent duplicate firings.
 *
 * @param {string} ruleId
 */
function markFired(ruleId) {
  cooldownCache.set(ruleId, Date.now());
}

// ─── evaluateThresholdRules() ────────────────────────────────────────────────

/**
 * Evaluate threshold-based rules against incoming telemetry data.
 *
 * For each enabled threshold rule, checks if:
 * 1. The rule's trigger field exists in the telemetry data
 * 2. The value satisfies the comparison operator against the threshold
 * 3. The rule is not in cooldown
 *
 * @param {string} tenantId — tenant context (passed through, not used in pure evaluation)
 * @param {string} deviceId — device context (passed through)
 * @param {object} telemetryData — flat key-value telemetry payload
 * @param {object[]} rules — array of rule objects from DB
 * @returns {object[]} — matching rules with match details
 */
function evaluateThresholdRules(tenantId, deviceId, telemetryData, rules) {
  const matches = [];

  for (const rule of rules) {
    // Filter: must be threshold type and enabled
    if (rule.trigger_type !== 'threshold') continue;
    if (!rule.enabled) continue;

    const { datastreamKey: field, operator, value: threshold } = rule.trigger_config;

    // Skip if the telemetry field doesn't exist
    if (!(field in telemetryData)) continue;

    const telemetryValue = telemetryData[field];

    // Compare
    if (!compare(telemetryValue, operator, threshold)) continue;

    // Check cooldown
    if (!checkCooldown(rule.id, rule.last_fired_at, rule.cooldown_ms)) continue;

    // Mark as fired in cache and collect match
    markFired(rule.id);
    matches.push({
      rule,
      matchedValue: telemetryValue,
      matchedField: field,
    });
  }

  return matches;
}

// ─── evaluateStatusRules() ───────────────────────────────────────────────────

/**
 * Evaluate status-based rules against a device status change.
 *
 * For each enabled status rule, checks if:
 * 1. The incoming status matches the rule's configured status
 * 2. The rule is not in cooldown
 *
 * @param {string} tenantId — tenant context (passed through)
 * @param {string} deviceId — device context (passed through)
 * @param {string} status — the device's new status
 * @param {object[]} rules — array of rule objects from DB
 * @returns {object[]} — matching rules with match details
 */
function evaluateStatusRules(tenantId, deviceId, status, rules) {
  const matches = [];

  for (const rule of rules) {
    // Filter: must be status type and enabled
    if (rule.trigger_type !== 'status') continue;
    if (!rule.enabled) continue;

    const { status: targetStatus } = rule.trigger_config;

    // Skip if status doesn't match
    if (status !== targetStatus) continue;

    // Check cooldown
    if (!checkCooldown(rule.id, rule.last_fired_at, rule.cooldown_ms)) continue;

    // Mark as fired in cache and collect match
    markFired(rule.id);
    matches.push({
      rule,
      matchedStatus: status,
    });
  }

  return matches;
}

// ─── executeAction() ──────────────────────────────────────────────────────────

/**
 * Execute an action based on the rule's action configuration.
 * Returns the action payload to be sent (e.g., via MQTT).
 *
 * Currently supports:
 * - relay → { action: 'relay', relay: N, state: boolean }
 * - command → { action: 'command', action: string, payload?: object }
 *
 * @param {object} rule — the rule object (with action_type and action_config)
 * @param {string} tenantId — tenant context
 * @returns {Promise<object>} — action result
 */
async function executeAction(rule, tenantId) {
  const { action_type, action_config } = rule;

  if (action_type === 'relay') {
    return {
      action: 'relay',
      relay: action_config.relay,
      state: action_config.state,
    };
  }

  if (action_type === 'command') {
    return {
      action: 'command',
      action: action_config.action,
      payload: action_config.payload,
    };
  }

  if (action_type === 'charging_start') {
    return {
      type: 'charging',
      action: 'start',
      deviceId: action_config.deviceId,
    };
  }

  if (action_type === 'charging_stop') {
    return {
      type: 'charging',
      action: 'stop',
      deviceId: action_config.deviceId,
    };
  }

  if (action_type === 'low_power_mode') {
    return {
      type: 'power_mode',
      action: 'low_power',
      deviceId: action_config.deviceId,
      durationMinutes: action_config.durationMinutes,
    };
  }

  throw new Error(`Unknown action type: ${action_type}`);
}

// ─── evaluateBatteryLowRules() ───────────────────────────────────────────────

/**
 * Evaluate battery_low trigger rules against incoming telemetry data.
 *
 * Fires when the battery level goes BELOW the configured threshold.
 *
 * @param {string} tenantId
 * @param {string} deviceId
 * @param {object} telemetryData
 * @param {object[]} rules
 * @returns {object[]}
 */
function evaluateBatteryLowRules(tenantId, deviceId, telemetryData, rules) {
  const matches = [];

  for (const rule of rules) {
    if (rule.trigger_type !== 'battery_low') continue;
    if (!rule.enabled) continue;

    const { field = 'battery_level', threshold } = rule.trigger_config;

    if (!(field in telemetryData)) continue;

    const batteryValue = telemetryData[field];
    if (typeof batteryValue !== 'number') continue;

    if (batteryValue >= threshold) continue;

    if (!checkCooldown(rule.id, rule.last_fired_at, rule.cooldown_ms)) continue;

    markFired(rule.id);
    matches.push({
      rule,
      matchedValue: batteryValue,
      matchedField: field,
    });
  }

  return matches;
}

module.exports = {
  compare,
  checkCooldown,
  markFired,
  resetCooldownCache,
  evaluateThresholdRules,
  evaluateStatusRules,
  evaluateBatteryLowRules,
  executeAction,
};
