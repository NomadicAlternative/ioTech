'use strict';

const logger = require('../../shared/logger');
const templatesService = require('../device-templates/device-templates.service');
const devicesService = require('../devices/devices.service');
const rulesService = require('../rules/rules.service');
const { validateAiConfig } = require('./ai.schemas');
const { ValidationError } = require('../../shared/errors');
const { buildSystemPrompt, buildUserPrompt, detectLanguage } = require('./context/prompt-builder');
const { getDefaultBoard } = require('./context/board-context');
const { listDrivers } = require('./context/driver-catalog');
const { listBoards } = require('./context/board-context');

/**
 * Call DeepSeek API (OpenAI-compatible) to generate the configuration.
 * Falls back to a rule-based parser if LLM is unavailable.
 */
async function callLLM(prompt, boardId) {
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  if (!apiKey) {
    logger.warn('[ai.service] DEEPSEEK_API_KEY not set — using rule-based fallback');
    return null;
  }

  const systemPrompt = buildSystemPrompt({ userPrompt: prompt, boardId });
  const lang = detectLanguage(prompt);
  const userPrompt = buildUserPrompt(prompt, lang);

  logger.info(
    `[ai.service] Calling LLM — lang=${lang} board=${boardId || 'default'} prompt_len=${prompt.length}`
  );

  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      logger.error(`[ai.service] LLM error ${res.status}: ${err}`);
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    try {
      return JSON.parse(content);
    } catch (e) {
      logger.error(`[ai.service] Failed to parse LLM JSON: ${content.substring(0, 200)}`);
      return null;
    }
  } catch (err) {
    logger.error(`[ai.service] LLM call failed: ${err.message}`);
    return null;
  }
}

/**
 * Rule-based fallback: parse the installer's input for keywords
 * and generate a basic config without LLM.
 */
function ruleBasedConfig(input, boardId) {
  const board =
    (boardId && require('./context/board-context').getBoard(boardId)) || getDefaultBoard();
  const lower = input.toLowerCase();
  const lang = detectLanguage(input);

  // Detect relays mentioned
  const relayOn = [];
  const relayOff = [];
  const relayPattern = /relay\s*(\d)/gi;
  let match;
  while ((match = relayPattern.exec(lower)) !== null) {
    const num = parseInt(match[1]);
    const before = lower.substring(Math.max(0, match.index - 50), match.index);
    if (
      before.includes('activ') ||
      before.includes('prender') ||
      before.includes('encender') ||
      before.includes('on')
    ) {
      relayOn.push(num);
    }
    if (before.includes('apagar') || before.includes('desactiv') || before.includes('off')) {
      relayOff.push(num);
    }
  }

  // Detect temperature threshold
  const tempMatch = lower.match(/(\d+)\s*(?:°|grados?|degrees?)/);
  const threshold = tempMatch ? parseInt(tempMatch[1]) : 12;

  // Detect sensor type
  const isBME =
    lower.includes('bme') ||
    lower.includes('presión') ||
    lower.includes('presion') ||
    lower.includes('pressure');
  const isPIR = lower.includes('pir') || lower.includes('movimiento') || lower.includes('motion');
  const isHCSR04 =
    lower.includes('hcsr04') ||
    lower.includes('distancia') ||
    lower.includes('distance') ||
    lower.includes('ultras');

  let sensorModel = 'DHT22';
  let sensorGpio = board.pins.dht;
  const datastreams = [];
  const drivers = [];

  if (isBME) {
    sensorModel = 'BME280';
    drivers.push({ model: 'BME280', i2c_addr: '0x76' });
    datastreams.push(
      {
        key: 'temperature',
        name: lang === 'es' ? 'Temperatura' : 'Temperature',
        type: 'number',
        unit: '°C',
        direction: 'input',
        driver_name: 'BME280',
        gpio: null,
        i2c_addr: '0x76',
        config: {},
      },
      {
        key: 'humidity',
        name: lang === 'es' ? 'Humedad' : 'Humidity',
        type: 'number',
        unit: '%',
        direction: 'input',
        driver_name: 'BME280',
        gpio: null,
        i2c_addr: '0x76',
        config: {},
      },
      {
        key: 'pressure',
        name: lang === 'es' ? 'Presión' : 'Pressure',
        type: 'number',
        unit: 'hPa',
        direction: 'input',
        driver_name: 'BME280',
        gpio: null,
        i2c_addr: '0x76',
        config: {},
      }
    );
  } else if (isPIR) {
    sensorModel = 'PIR';
    sensorGpio = board.pins.pir;
    drivers.push({ model: 'PIR', gpio: sensorGpio });
    datastreams.push({
      key: 'motion',
      name: lang === 'es' ? 'Movimiento' : 'Motion',
      type: 'boolean',
      unit: null,
      direction: 'input',
      driver_name: 'PIR',
      gpio: sensorGpio,
      i2c_addr: null,
      config: {},
    });
  } else if (isHCSR04) {
    sensorModel = 'HC-SR04';
    drivers.push({ model: 'HC-SR04', gpio: board.pins.hcsr04_trig, gpio2: board.pins.hcsr04_echo });
    datastreams.push({
      key: 'distance',
      name: lang === 'es' ? 'Distancia' : 'Distance',
      type: 'number',
      unit: 'cm',
      direction: 'input',
      driver_name: 'HC-SR04',
      gpio: board.pins.hcsr04_trig,
      i2c_addr: null,
      config: {},
    });
  } else {
    drivers.push({ model: 'DHT22', gpio: sensorGpio });
    datastreams.push(
      {
        key: 'temperature',
        name: lang === 'es' ? 'Temperatura' : 'Temperature',
        type: 'number',
        unit: '°C',
        direction: 'input',
        driver_name: 'DHT22',
        gpio: sensorGpio,
        i2c_addr: null,
        config: {},
      },
      {
        key: 'humidity',
        name: lang === 'es' ? 'Humedad' : 'Humidity',
        type: 'number',
        unit: '%',
        direction: 'input',
        driver_name: 'DHT22',
        gpio: sensorGpio,
        i2c_addr: null,
        config: {},
      }
    );
  }

  // Build relay channels using actual board pins
  const channels = [];
  const maxRelay = Math.max(board.pins.relays.length, ...relayOn, ...relayOff, 1);
  for (let i = 1; i <= Math.min(maxRelay, board.pins.relays.length); i++) {
    const relayPin = board.pins.relays[i - 1];
    if (relayPin && relayPin.gpio !== 0xff) {
      channels.push({
        num: i,
        gpio: relayPin.gpio,
        name: relayPin.name || `${lang === 'es' ? 'Relé' : 'Relay'} ${i}`,
      });
      datastreams.push({
        key: `relay${i}`,
        name: relayPin.name || `${lang === 'es' ? 'Relé' : 'Relay'} ${i}`,
        type: 'string',
        unit: null,
        direction: 'output',
        driver_name: 'RELAY',
        gpio: relayPin.gpio,
        i2c_addr: null,
        config: { channel: i },
      });
    }
  }
  if (channels.length > 0) {
    drivers.push({ model: 'RELAY', channels });
  }

  // Build actions
  const actions = [];
  relayOn.forEach((r) => actions.push({ type: 'relay', relay: r, state: 'on' }));
  relayOff.forEach((r) => actions.push({ type: 'relay', relay: r, state: 'off' }));

  // Build rules
  const rules = [];
  if (actions.length > 0) {
    const dsKey = datastreams[0] ? datastreams[0].key : 'temperature';
    rules.push({
      name:
        lang === 'es'
          ? `Control automático a ${threshold}°C`
          : `Automatic control at ${threshold}°C`,
      description:
        lang === 'es'
          ? `Activar acciones cuando ${dsKey} supera ${threshold}`
          : `Trigger actions when ${dsKey} exceeds ${threshold}`,
      condition: { datastream: dsKey, operator: '>=', value: threshold },
      actions,
      cooldown_seconds: 60,
    });
  }

  // Build diagram
  const lines = [];
  if (sensorModel === 'BME280') {
    lines.push(
      `ESP32 GPIO${board.pins.i2c_sda} (SDA) → BME280 SDA`,
      `ESP32 GPIO${board.pins.i2c_scl} (SCL) → BME280 SCL`,
      `ESP32 3.3V → BME280 VCC`,
      `ESP32 GND → BME280 GND`
    );
  } else if (sensorModel === 'HC-SR04') {
    lines.push(
      `ESP32 GPIO${board.pins.hcsr04_trig} → HC-SR04 TRIG`,
      `ESP32 GPIO${board.pins.hcsr04_echo} → HC-SR04 ECHO`,
      `HC-SR04 VCC → 5V`,
      `HC-SR04 GND → GND`
    );
  } else {
    lines.push(
      `ESP32 GPIO${sensorGpio} → ${sensorModel} DAT`,
      `ESP32 3.3V → ${sensorModel} VCC`,
      `ESP32 GND → ${sensorModel} GND`
    );
    if (sensorModel === 'DHT22') {
      lines.push('⚠️ Pull-up 10K entre VCC y DAT');
    }
  }
  channels.forEach((r) => lines.push(`ESP32 GPIO${r.gpio} → ${r.name}`));

  const tplName =
    lang === 'es'
      ? channels.length > 0
        ? `Control con ${sensorModel} ${channels.length}CH`
        : `Sensor ${sensorModel}`
      : channels.length > 0
        ? `${sensorModel} Control ${channels.length}CH`
        : `${sensorModel} Sensor`;

  return {
    template: {
      name: tplName,
      description:
        lang === 'es'
          ? `Template generado: ${sensorModel} + ${channels.length} relays`
          : `Generated template: ${sensorModel} + ${channels.length} relays`,
    },
    drivers,
    datastreams,
    rules,
    diagrama: lines.join('\\n'),
    _fallback: true,
  };
}

/**
 * Main configure function — tries LLM first, falls back to rules.
 */
async function configure(prompt, boardId) {
  const llmResult = await callLLM(prompt, boardId);
  const raw = llmResult && llmResult.template ? llmResult : ruleBasedConfig(prompt, boardId);

  // Validate against contract schema — reject invalid AI output
  const validation = validateAiConfig(raw);
  if (validation.error) {
    logger.error(`[ai.service] AI generated invalid config: ${validation.error}`);
    throw new ValidationError(validation.error);
  }

  return {
    ...validation.value,
    _source: llmResult && llmResult.template ? 'ai' : 'rule-based-fallback',
  };
}

/**
 * Apply the AI-generated configuration: create template, device, and rules.
 */
async function apply(tenantId, config) {
  // Validate against contract schema BEFORE touching DB
  const validation = validateAiConfig(config);
  if (validation.error) {
    throw new ValidationError(validation.error);
  }
  config = validation.value; // use sanitized version

  const { template, datastreams, rules, drivers } = config;
  const hardwareModel = template.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+$/, '');

  // 1. Create device template
  const createdTemplate = await templatesService.create(tenantId, {
    name: template.name,
    description: template.description,
    datastreams: datastreams.map((ds) => ({
      key: ds.key,
      name: ds.name,
      type: ds.type,
      unit: ds.unit || null,
      direction: ds.direction,
      driver_name: ds.driver_name || null,
      gpio: ds.gpio || null,
      i2c_addr: ds.i2c_addr || null,
      config: ds.config || null,
    })),
    hardware_model: hardwareModel,
  });

  // 2. Create device with drivers stored in metadata
  const createdDevice = await devicesService.create(tenantId, {
    name: template.name,
    templateId: createdTemplate.id,
    metadata: drivers ? { drivers } : {},
  });

  // 3. Create rules
  const createdRules = [];
  for (const rule of rules || []) {
    const r = await rulesService.create(tenantId, {
      name: rule.name,
      description: rule.description || '',
      triggerType: 'threshold',
      triggerConfig: rule.condition,
      actionType: 'relay',
      actionConfig: { actions: rule.actions },
      cooldownMs: (rule.cooldown_seconds || 60) * 1000,
      enabled: true,
    });
    createdRules.push(r);
  }

  logger.info(
    `[ai.service] Applied config: template=${createdTemplate.id} device=${createdDevice.id} rules=${createdRules.length}`
  );

  return {
    template: createdTemplate,
    device: createdDevice,
    rules: createdRules,
    hardware_model: hardwareModel,
    claim_token: createdDevice.claim_token,
  };
}

/**
 * Capability catalog — all supported components.
 * Keep in sync with firmware drivers.
 */
/**
 * Return the full capability catalog — dynamically generated from the
 * board context and driver catalog modules.
 */
function getCatalog() {
  const boards = listBoards().map((b) => ({
    model: b.name,
    chip: b.chip,
    description: b.description.es,
    note: null,
  }));

  const allDrivers = listDrivers();

  const sensors = allDrivers
    .filter((d) => d.category === 'sensor')
    .map((d) => ({ model: d.model, description: d.description.es, protocol: d.protocol }));

  const actuators = allDrivers
    .filter((d) => d.category === 'actuator')
    .map((d) => ({
      model: d.model,
      description: d.description.es,
      note: d.notes ? d.notes.es.split('.')[0] : null,
    }));

  const displays = allDrivers
    .filter((d) => d.category === 'display')
    .map((d) => ({ model: d.model, description: d.description.es, protocol: d.protocol }));

  return {
    boards,
    connectivity: [
      { model: 'WIFI', description: 'WiFi 2.4GHz', note: 'Obligatorio' },
      { model: 'MQTT', description: 'MQTT (Mosquitto)', note: 'Obligatorio' },
      { model: 'BLE', description: 'Bluetooth Low Energy', note: 'Beacons, nearby' },
    ],
    sensors,
    actuators,
    displays,
  };
}

/**
 * Return a sample system prompt for testing and inspection.
 * Uses the default board and a sample Spanish prompt.
 */
function getSystemPrompt() {
  return buildSystemPrompt({
    userPrompt: 'Tengo un ESP32 con DHT22 y quiero controlar un relay',
    maxExamples: 1,
  });
}

module.exports = { configure, apply, getCatalog, getSystemPrompt };
