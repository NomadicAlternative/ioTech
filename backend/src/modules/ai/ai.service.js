'use strict';

const { getLocalIp } = require('../../shared/network');
const logger = require('../../shared/logger');

/**
 * System prompt that teaches the LLM everything about iotech's
 * configuration format: templates, GPIO pins, rules, and provisioning.
 */
const SYSTEM_PROMPT = `Eres un asistente de configuración para iotech, una plataforma IoT B2B2C.

Tu trabajo: dado lo que describe un instalador, devolvé un JSON con la configuración del dispositivo.

REGLAS:
1. Usá SOLO este formato JSON de respuesta. Nada de texto extra.
2. Los pines GPIO del ESP32 disponibles para relays: 23, 22, 21, 19, 18, 5, 17 (módulo de 7 relays, active LOW).
3. Los pines GPIO disponibles para sensores: 14, 27, 26, 25, 33, 32, 34, 35, 36, 39.
4. Para DHT22 usar GPIO 14 por defecto.
5. El firmware ya maneja: DHT22, DS18B20, relays (on/off), ADC (0-3.3V).
6. Las reglas usan este formato: { condition: "datastreamKey >= valor", actions: [{ relay: numero, state: "on"|"off" }] }
7. El nombre del template debe ser descriptivo y en español.
8. Incluí SIEMPRE una sección "pines" con el diagrama de conexiones.
9. Los relays se numeran de 1 a 7.

Formato de respuesta OBLIGATORIO:
{
  "template": {
    "name": "Nombre del template",
    "description": "Descripción breve"
  },
  "datastreams": [
    { "key": "temp", "name": "Temperatura", "type": "number", "unit": "°C", "direction": "input" }
  ],
  "pines": {
    "sensores": [
      { "tipo": "DHT22", "gpio": 14, "nombre": "Temperatura" }
    ],
    "relays": [
      { "numero": 1, "gpio": 23, "nombre": "Relay 1" },
      { "numero": 2, "gpio": 22, "nombre": "Relay 2" }
    ]
  },
  "rules": [
    {
      "name": "Nombre de la regla",
      "description": "Descripción",
      "condition": { "datastream": "temp", "operator": ">=", "value": 12 },
      "actions": [
        { "type": "relay", "relay": 1, "state": "on" },
        { "type": "relay", "relay": 3, "state": "off" }
      ]
    }
  ],
  "diagrama": "ESP32 GPIO14 → DHT22 datos\\nESP32 GPIO23 → Relay 1\\n..."
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
        'Authorization': `Bearer ${apiKey}`,
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
    if (before.includes('activ') || before.includes('prender') || before.includes('encender') || before.includes('on')) {
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
  const isDHT = lower.includes('dht') || lower.includes('humedad') || (lower.includes('temperatura') && !lower.includes('ds18'));
  const sensorType = isDHT ? 'DHT22' : 'DS18B20';
  const sensorPin = 14;

  // Build relay list
  const relays = [];
  for (let i = 1; i <= 7; i++) {
    const gpios = [23, 22, 21, 19, 18, 5, 17];
    relays.push({ numero: i, gpio: gpios[i - 1], nombre: `Relay ${i}` });
  }

  // Build actions
  const actions = [];
  relayOn.forEach(r => actions.push({ type: 'relay', relay: r, state: 'on' }));
  relayOff.forEach(r => actions.push({ type: 'relay', relay: r, state: 'off' }));

  // Build rules
  const rules = [];
  if (actions.length > 0) {
    rules.push({
      name: `Control de temperatura a ${threshold}°C`,
      description: `Cuando temperatura >= ${threshold}°C, ejecutar acciones configuradas`,
      condition: { datastream: 'temp', operator: '>=', value: threshold },
      actions,
      cooldown_seconds: 60,
    });
  }

  // Build diagram
  const lines = [`ESP32 GPIO${sensorPin} → ${sensorType} datos`, `ESP32 3.3V → ${sensorType} VCC`, `ESP32 GND → ${sensorType} GND`];
  relays.forEach(r => lines.push(`ESP32 GPIO${r.gpio} → ${r.nombre}`));

  return {
    template: {
      name: relays.length > 0 ? `Control Térmico ${relays.length}CH` : 'Sensor de Temperatura',
      description: `Template generado automáticamente: ${sensorType} + ${relays.length} relays`,
    },
    datastreams: [
      { key: 'temp', name: 'Temperatura', type: 'number', unit: '°C', direction: 'input' },
    ],
    pines: {
      sensores: [{ tipo: sensorType, gpio: sensorPin, nombre: 'Temperatura' }],
      relays,
    },
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
  if (llmResult && llmResult.template) {
    return { ...llmResult, _source: 'ai' };
  }
  return { ...ruleBasedConfig(prompt), _source: 'rule-based-fallback' };
}

module.exports = { configure };
