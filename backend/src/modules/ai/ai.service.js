'use strict';

const { getLocalIp } = require('../../shared/network');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../shared/logger');
const templatesService = require('../device-templates/device-templates.service');
const devicesService = require('../devices/devices.service');
const rulesService = require('../rules/rules.service');
const { validateAiConfig } = require('./ai.schemas');
const { ValidationError } = require('../../shared/errors');

/**
 * System prompt that teaches the LLM everything about iotech's
 * configuration format: templates, GPIO pins, rules, and provisioning.
 */
const SYSTEM_PROMPT = `Eres un asistente de configuración para iotech, una plataforma IoT B2B2C.

Tu trabajo: dado lo que describe un instalador, devolvé un JSON con la configuración del dispositivo.

El firmware de iotech es GENÉRICO — usa drivers activables por configuración. No necesitás generar código C, solo describir qué drivers activar y con qué pines.

DRIVERS DISPONIBLES:
- DHT11: temperatura + humedad, 1-wire
- DHT22: temperatura + humedad, 1-wire  
- BME280: temperatura + humedad + presión, I2C (0x76 o 0x77)
- BMP280: temperatura + presión, I2C
- DS18B20: temperatura, 1-wire
- PIR: movimiento, GPIO digital
- HC-SR04: distancia ultrasónica, GPIO trigger + echo
- BH1750: luz (lux), I2C (0x23)
- RELAY: actuador on/off, hasta 8 canales, active LOW
- WS2812B: LED RGB direccionable
- SERVO: servo motor, PWM
- SSD1306: pantalla OLED 128x64, I2C (0x3C)
- BUZZER: activo o pasivo, GPIO

PINES GPIO DISPONIBLES:
- Sensores digitales/I2C: 14, 27, 26, 25, 33, 32
- Relays (active LOW): 23, 22, 21, 19, 18, 5, 17
- ADC: 34, 35, 36, 39 (solo entrada analógica)
- I2C por defecto: SDA=21, SCL=22 (se puede cambiar)

REGLAS:
1. Usá SOLO este formato JSON de respuesta. Nada de texto extra.
2. El array "drivers" es OBLIGATORIO — cada entry activa un driver con su config de pines.
3. Para relays, especificá channels (array con num + gpio + name).
4. Para sensores, especificá gpio o i2c_addr según corresponda.
5. Para I2C, asumí SDA=21, SCL=22 a menos que el instalador diga otra cosa.
6. Las reglas usan datastream keys (ej: "temperature", "relay1").
7. Incluí SIEMPRE "diagrama" con las conexiones físicas.
8. El nombre del template en español, descriptivo.
9. Los relays se numeran de 1 a N.
10. Cada datastream puede incluir campos opcionales: "driver_name" (nombre del driver, máx 16 chars), "gpio" (0-48, usar null si no aplica), "i2c_addr" (string como "0x76", null si no es I2C), "config" (objeto con config específica, null o {}).

Formato de respuesta OBLIGATORIO:
{
  "template": { "name": "...", "description": "..." },
  "drivers": [
    { "model": "DHT22", "gpio": 14 },
    { "model": "RELAY", "channels": [
      { "num": 1, "gpio": 23, "name": "Relay 1" }
    ]}
  ],
  "datastreams": [
    { "key": "temperature", "name": "Temperatura", "type": "number", "unit": "°C", "direction": "input", "driver_name": "DHT22", "gpio": 32, "i2c_addr": null, "config": {} }
  ],
  "rules": [
    {
      "name": "...",
      "description": "...",
      "condition": { "datastream": "temperature", "operator": ">=", "value": 12 },
      "actions": [
        { "type": "relay", "relay": 1, "state": "on" }
      ]
    }
  ],
  "diagrama": "ESP32 GPIO14 → DHT22 datos\\nESP32 3.3V → DHT22 VCC\\n..."
}`;

/**
 * Build the user prompt from the installer's input.
 */
function buildUserPrompt(input) {
  return `Instalador dice: "${input}"

Generá la configuración JSON según el formato especificado.`;
}

/**
 * Call DeepSeek API (OpenAI-compatible) to generate the configuration.
 * Falls back to a rule-based parser if LLM is unavailable.
 */
async function callLLM(prompt) {
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  if (!apiKey) {
    logger.warn('[ai.service] DEEPSEEK_API_KEY not set — using rule-based fallback');
    return null;
  }

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
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(prompt) },
        ],
        temperature: 0.1,
        max_tokens: 2000,
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
function ruleBasedConfig(input) {
  const lower = input.toLowerCase();

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
  const tempMatch = lower.match(/(\d+)\s*(?:°|grados?)/);
  const threshold = tempMatch ? parseInt(tempMatch[1]) : 12;

  // Detect sensor type
  const isDHT =
    lower.includes('dht') ||
    lower.includes('humedad') ||
    (lower.includes('temperatura') && !lower.includes('ds18'));
  const sensorModel = isDHT ? 'DHT22' : 'DS18B20';
  const sensorPin = 14;

  // Build relay channels
  const gpios = [23, 22, 21, 19, 18, 5, 17];
  const channels = [];
  const maxRelay = Math.max(7, ...relayOn, ...relayOff, 1);
  for (let i = 1; i <= maxRelay; i++) {
    channels.push({ num: i, gpio: gpios[i - 1], name: `Relay ${i}` });
  }

  // Build actions
  const actions = [];
  relayOn.forEach((r) => actions.push({ type: 'relay', relay: r, state: 'on' }));
  relayOff.forEach((r) => actions.push({ type: 'relay', relay: r, state: 'off' }));

  // Build rules
  const rules = [];
  if (actions.length > 0) {
    rules.push({
      name: `Control de temperatura a ${threshold}°C`,
      description: `Cuando temperatura >= ${threshold}°C, ejecutar acciones configuradas`,
      condition: { datastream: 'temperature', operator: '>=', value: threshold },
      actions,
      cooldown_seconds: 60,
    });
  }

  // Build diagram
  const lines = [
    `ESP32 GPIO${sensorPin} → ${sensorModel} datos`,
    `ESP32 3.3V → ${sensorModel} VCC`,
    `ESP32 GND → ${sensorModel} GND`,
  ];
  channels.forEach((r) => lines.push(`ESP32 GPIO${r.gpio} → ${r.name}`));

  return {
    template: {
      name: channels.length > 0 ? `Control Térmico ${channels.length}CH` : 'Sensor de Temperatura',
      description: `Template generado: ${sensorModel} + ${channels.length} relays`,
    },
    drivers: [
      { model: sensorModel, gpio: sensorPin },
      { model: 'RELAY', channels },
    ],
    datastreams: [
      { key: 'temperature', name: 'Temperatura', type: 'number', unit: '°C', direction: 'input' },
    ],
    rules,
    diagrama: lines.join('\\n'),
    _fallback: true,
  };
}

/**
 * Main configure function — tries LLM first, falls back to rules.
 */
async function configure(prompt) {
  const llmResult = await callLLM(prompt);
  const raw = llmResult && llmResult.template ? llmResult : ruleBasedConfig(prompt);

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
const CATALOG = {
  boards: [
    { model: 'ESP32', description: 'ESP32 (WiFi + BLE)', note: 'Principal' },
    { model: 'ESP32-S3', description: 'ESP32-S3 (WiFi + BLE + AI)', note: 'Cámara, edge ML' },
    { model: 'ESP32-C3', description: 'ESP32-C3 (WiFi + BLE)', note: 'RISC-V, bajo consumo' },
  ],
  connectivity: [
    { model: 'WIFI', description: 'WiFi 2.4GHz', note: 'Obligatorio' },
    { model: 'MQTT', description: 'MQTT (Mosquitto)', note: 'Obligatorio' },
    { model: 'BLE', description: 'Bluetooth Low Energy', note: 'Beacons, nearby' },
  ],
  sensors: [
    { model: 'DHT11', description: 'Temperatura + Humedad básica', protocol: '1-wire' },
    { model: 'DHT22', description: 'Temperatura + Humedad precisión', protocol: '1-wire' },
    { model: 'BME280', description: 'Temperatura + Humedad + Presión', protocol: 'I2C (0x76)' },
    { model: 'BMP280', description: 'Temperatura + Presión', protocol: 'I2C' },
    { model: 'DS18B20', description: 'Temperatura digital', protocol: '1-wire Dallas' },
    { model: 'PIR', description: 'Sensor de movimiento HC-SR501', protocol: 'GPIO digital' },
    {
      model: 'HC-SR04',
      description: 'Distancia ultrasónica 2cm-4m',
      protocol: 'GPIO trigger/echo',
    },
    { model: 'BH1750', description: 'Luz (lux) ambiental', protocol: 'I2C (0x23)' },
  ],
  actuators: [
    { model: 'RELAY', description: 'Relé/módulo de relés 1-8 canales', note: 'Active LOW' },
    { model: 'WS2812B', description: 'Tira LED RGB direccionable', note: 'Neopixel' },
    { model: 'SERVO', description: 'Servomotor SG90 / MG996R 0-180°', note: 'PWM' },
    { model: 'BUZZER', description: 'Buzzer activo/pasivo', note: 'Alarma' },
  ],
  displays: [
    { model: 'SSD1306', description: 'OLED 128x64 monocromo', protocol: 'I2C (0x3C)' },
    { model: 'LCD1602', description: 'LCD 16x2 caracteres con I2C', protocol: 'I2C (0x27)' },
  ],
};

/**
 * Return the full capability catalog for the AI assistant UI.
 */
function getCatalog() {
  return CATALOG;
}

/**
 * Return the system prompt for testing and inspection.
 */
function getSystemPrompt() {
  return SYSTEM_PROMPT;
}

module.exports = { configure, apply, getCatalog, getSystemPrompt };
