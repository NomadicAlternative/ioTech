'use strict';

/**
 * End-to-end contract test: AI → Rules Engine → MQTT
 *
 * Verifies the full pipeline:
 * 1. AI-generated config passes schema validation
 * 2. Rule is persisted correctly
 * 3. Telemetry triggers the rule
 * 4. Rule produces correct MQTT command payload
 *
 * This test catches the 3 bugs we had today:
 * - datastream vs datastreamKey mismatch
 * - >= vs gte operator mismatch
 * - actions[0].relay vs relay direct mismatch
 */

const { validateAiConfig } = require('../ai.schemas');
const rulesEngine = require('../../rules/rulesEngine');

// ─── AI Config Validation ─────────────────────────────────────────────────

describe('AI Config Schema Contract', () => {
  const validConfig = {
    template: { name: 'Control Térmico', description: 'DHT22 + relay' },
    drivers: [{ model: 'DHT22', gpio: 32 }],
    datastreams: [
      { key: 'temperature', name: 'Temperatura', type: 'number', unit: '°C', direction: 'input' },
    ],
    rules: [
      {
        name: 'Activar relay si temp >= 26',
        description: 'Control térmico',
        condition: { datastream: 'temperature', operator: '>=', value: 26 },
        actions: [{ type: 'relay', relay: 1, state: 'on' }],
        cooldown_seconds: 60,
      },
    ],
    diagrama: 'GPIO32 → DHT22',
  };

  test('accepts valid AI config', () => {
    const { error } = validateAiConfig(validConfig);
    expect(error).toBeUndefined();
  });

  test('rejects config with datastreamKey instead of datastream', () => {
    const bad = JSON.parse(JSON.stringify(validConfig));
    bad.rules[0].condition = { datastreamKey: 'temperature', operator: '>=', value: 26 };
    const { error } = validateAiConfig(bad);
    expect(error).toBeDefined();
    expect(error).toContain('datastream');
  });

  test('accepts all valid operators (>=, <=, >, <, ==, !=)', () => {
    for (const op of ['>', '>=', '<', '<=', '==', '!=']) {
      const config = JSON.parse(JSON.stringify(validConfig));
      config.rules[0].condition.operator = op;
      const { error } = validateAiConfig(config);
      expect(error).toBeUndefined();
    }
  });

  test('rejects invalid operator', () => {
    const bad = JSON.parse(JSON.stringify(validConfig));
    bad.rules[0].condition.operator = 'gte';
    const { error } = validateAiConfig(bad);
    expect(error).toBeDefined();
    expect(error).toContain('operator');
  });

  test('accepts forward-compatible action types (buzzer, servo, etc.)', () => {
    const config = JSON.parse(JSON.stringify(validConfig));
    config.rules[0].actions = [{ type: 'buzzer', tone: 440 }];
    const { error } = validateAiConfig(config);
    expect(error).toBeUndefined();
  });
});

// ─── Rules Engine Contract ─────────────────────────────────────────────────

describe('Rules Engine — Threshold Evaluation', () => {
  const rule = {
    id: 'test-rule-1',
    name: 'Test Rule',
    trigger_type: 'threshold',
    enabled: true,
    trigger_config: { datastream: 'temperature', operator: '>=', value: 26 },
    action_type: 'relay',
    action_config: { actions: [{ relay: 1, state: 'on' }] },
    last_fired_at: null,
    cooldown_ms: 0,
  };

  test('fires when temperature >= threshold', () => {
    const matches = rulesEngine.evaluateThresholdRules(
      'tenant-1',
      'device-1',
      { temperature: 27.5 },
      [rule]
    );
    expect(matches.length).toBe(1);
    expect(matches[0].matchedField).toBe('temperature');
    expect(matches[0].matchedValue).toBe(27.5);
  });

  test('does NOT fire when temperature below threshold', () => {
    const matches = rulesEngine.evaluateThresholdRules(
      'tenant-1',
      'device-1',
      { temperature: 20 },
      [rule]
    );
    expect(matches.length).toBe(0);
  });

  test('fires on exact threshold match (>=)', () => {
    const matches = rulesEngine.evaluateThresholdRules(
      'tenant-1',
      'device-1',
      { temperature: 26 },
      [rule]
    );
    expect(matches.length).toBe(1);
  });

  test('skips rule if datastream not in telemetry', () => {
    const matches = rulesEngine.evaluateThresholdRules('tenant-1', 'device-1', { humidity: 50 }, [
      rule,
    ]);
    expect(matches.length).toBe(0);
  });

  test('skips disabled rule', () => {
    const disabled = { ...rule, enabled: false };
    const matches = rulesEngine.evaluateThresholdRules(
      'tenant-1',
      'device-1',
      { temperature: 30 },
      [disabled]
    );
    expect(matches.length).toBe(0);
  });

  test('skips non-threshold rule', () => {
    const status = { ...rule, trigger_type: 'status' };
    const matches = rulesEngine.evaluateThresholdRules(
      'tenant-1',
      'device-1',
      { temperature: 30 },
      [status]
    );
    expect(matches.length).toBe(0);
  });

  test('handles <= operator', () => {
    const cold = {
      ...rule,
      trigger_config: { datastream: 'temperature', operator: '<=', value: 10 },
    };
    const matches = rulesEngine.evaluateThresholdRules('tenant-1', 'device-1', { temperature: 5 }, [
      cold,
    ]);
    expect(matches.length).toBe(1);
  });
});

// ─── Rules Engine — Action Execution ───────────────────────────────────────

describe('Rules Engine — Action Execution', () => {
  test('extracts relay from actions array', async () => {
    const rule = {
      action_type: 'relay',
      action_config: { actions: [{ relay: 1, state: 'on' }] },
    };
    const result = await rulesEngine.executeAction(rule, 'tenant-1');
    expect(result.relay).toBe(1);
    expect(result.state).toBe('on');
  });

  test('supports multiple relay actions in array', async () => {
    const rule = {
      action_type: 'relay',
      action_config: {
        actions: [
          { relay: 1, state: 'on' },
          { relay: 3, state: 'off' },
        ],
      },
    };
    // Currently only extracts first action — test documents current behavior
    const result = await rulesEngine.executeAction(rule, 'tenant-1');
    expect(result.relay).toBe(1);
    expect(result.state).toBe('on');
  });

  test('returns pending for unsupported action type (no crash)', async () => {
    const rule = {
      action_type: 'buzzer',
      action_config: { tone: 440 },
    };
    const result = await rulesEngine.executeAction(rule, 'tenant-1');
    expect(result.status).toBe('pending');
    expect(result.action).toBe('buzzer');
  });
});

// ─── A.1: New driver fields in datastream schema ───────────────────────────

describe('AI Config Schema — Driver Fields (io-driver)', () => {
  const validWithDriverFields = {
    template: { name: 'DHT22 Test', description: 'Test driver fields' },
    drivers: [{ model: 'DHT22', gpio: 32 }],
    datastreams: [
      {
        key: 'temperature',
        name: 'Temperatura',
        type: 'number',
        unit: '°C',
        direction: 'input',
        driver_name: 'DHT22',
        gpio: 32,
        i2c_addr: null,
        config: {},
      },
    ],
    rules: [],
    diagrama: '',
  };

  test('accepts datastream with driver_name, gpio, i2c_addr, config fields', () => {
    const { error, value } = validateAiConfig(validWithDriverFields);
    expect(error).toBeUndefined();
    expect(value.datastreams[0].driver_name).toBe('DHT22');
    expect(value.datastreams[0].gpio).toBe(32);
    expect(value.datastreams[0].i2c_addr).toBeNull();
    expect(value.datastreams[0].config).toBeDefined();
  });

  test('rejects gpio outside valid range (e.g., -1)', () => {
    const bad = JSON.parse(JSON.stringify(validWithDriverFields));
    bad.datastreams[0].gpio = -1;
    const { error } = validateAiConfig(bad);
    expect(error).toBeDefined();
    expect(error).toContain('gpio');
  });

  test('rejects gpio > 48', () => {
    const bad = JSON.parse(JSON.stringify(validWithDriverFields));
    bad.datastreams[0].gpio = 49;
    const { error } = validateAiConfig(bad);
    expect(error).toBeDefined();
    expect(error).toContain('gpio');
  });

  test('stripUnknown does NOT strip the new driver fields', () => {
    const { value } = validateAiConfig(validWithDriverFields);
    expect(value.datastreams[0].driver_name).toBe('DHT22');
    expect(value.datastreams[0].gpio).toBe(32);
  });

  test('accepts datastream without new fields (backward compatible)', () => {
    const withoutNew = {
      template: { name: 'Basic', description: 'Just required fields' },
      drivers: [],
      datastreams: [{ key: 't', name: 'T', type: 'number', direction: 'input' }],
      rules: [],
      diagrama: '',
    };
    const { error } = validateAiConfig(withoutNew);
    expect(error).toBeUndefined();
  });

  test('rejects driver_name longer than 16 characters', () => {
    const bad = JSON.parse(JSON.stringify(validWithDriverFields));
    bad.datastreams[0].driver_name = 'VERY_LONG_DRIVER_NAME_17CHARS';
    const { error } = validateAiConfig(bad);
    expect(error).toBeDefined();
    expect(error).toContain('driver_name');
  });

  test('coerces string gpio to integer (Joi default behavior)', () => {
    const config = JSON.parse(JSON.stringify(validWithDriverFields));
    config.datastreams[0].gpio = '32';
    const { error, value } = validateAiConfig(config);
    expect(error).toBeUndefined();
    expect(value.datastreams[0].gpio).toBe(32);
  });

  test('accepts i2c_addr as string (e.g., "0x76")', () => {
    const config = JSON.parse(JSON.stringify(validWithDriverFields));
    config.datastreams[0].i2c_addr = '0x76';
    config.datastreams[0].gpio = null; // I2C devices may not have gpio
    const { error } = validateAiConfig(config);
    expect(error).toBeUndefined();
  });

  test('accepts config as object with arbitrary keys', () => {
    const config = JSON.parse(JSON.stringify(validWithDriverFields));
    config.datastreams[0].config = { channel: 1, oversampling: 'x1' };
    const { error } = validateAiConfig(config);
    expect(error).toBeUndefined();
  });
});

// ─── A.2: apply() passes through new driver fields ──────────────────────────

describe('AI Service — apply() driver field passthrough', () => {
  let aiService;
  let templatesService;
  let devicesService;
  let rulesService;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../device-templates/device-templates.service', () => ({
      create: jest.fn(),
    }));
    jest.mock('../../devices/devices.service', () => ({
      create: jest.fn(),
    }));
    jest.mock('../../rules/rules.service', () => ({
      create: jest.fn(),
    }));
    jest.mock('../../../shared/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));

    aiService = require('../ai.service');
    templatesService = require('../../device-templates/device-templates.service');
    devicesService = require('../../devices/devices.service');
    rulesService = require('../../rules/rules.service');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('apply() passes driver_name, gpio, i2c_addr, config to template datastreams', async () => {
    templatesService.create.mockResolvedValue({ id: 'template-1' });
    devicesService.create.mockResolvedValue({ id: 'device-1', claim_token: 'claim-123' });
    rulesService.create.mockResolvedValue({ id: 'rule-1' });

    const config = {
      template: { name: 'Driver Test', description: 'Test driver passthrough' },
      drivers: [{ model: 'DHT22', gpio: 32, config: {} }],
      datastreams: [
        {
          key: 'temperature',
          name: 'Temperatura',
          type: 'number',
          unit: '°C',
          direction: 'input',
          driver_name: 'DHT22',
          gpio: 32,
          i2c_addr: null,
          config: { oversampling: 'x1' },
        },
      ],
      rules: [],
    };

    await aiService.apply('tenant-1', config);

    const createCall = templatesService.create.mock.calls[0];
    const passedDs = createCall[1].datastreams[0];
    expect(passedDs.driver_name).toBe('DHT22');
    expect(passedDs.gpio).toBe(32);
    expect(passedDs.i2c_addr).toBeNull();
    expect(passedDs.config).toEqual({ oversampling: 'x1' });
  });

  test('apply() handles datastreams without driver fields (backward compat)', async () => {
    templatesService.create.mockResolvedValue({ id: 'template-2' });
    devicesService.create.mockResolvedValue({ id: 'device-2', claim_token: 'claim-456' });
    rulesService.create.mockResolvedValue({ id: 'rule-2' });

    const config = {
      template: { name: 'Basic', description: 'No driver fields' },
      drivers: [],
      datastreams: [
        {
          key: 'temperature',
          name: 'Temperatura',
          type: 'number',
          direction: 'input',
        },
      ],
      rules: [],
    };

    await aiService.apply('tenant-1', config);

    const createCall = templatesService.create.mock.calls[0];
    const passedDs = createCall[1].datastreams[0];
    expect(passedDs.key).toBe('temperature');
    expect(passedDs.driver_name).toBeNull();
    expect(passedDs.gpio).toBeNull();
  });
});

// ─── A.3: SYSTEM_PROMPT includes new driver fields ───────────────────────────

describe('AI Service — SYSTEM_PROMPT driver field documentation', () => {
  test('SYSTEM_PROMPT contains driver_name as available datastream field', () => {
    const aiService = require('../ai.service');
    const prompt = aiService.getSystemPrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt).toContain('driver_name');
  });

  test('SYSTEM_PROMPT mentions gpio, i2c_addr, config as optional datastream fields', () => {
    const aiService = require('../ai.service');
    const prompt = aiService.getSystemPrompt();
    expect(prompt).toContain('gpio');
    expect(prompt).toContain('i2c_addr');
    expect(prompt).toContain('config');
  });
});
