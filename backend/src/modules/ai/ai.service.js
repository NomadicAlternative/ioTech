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
 * Build C++ code string from the parsed configuration.
 * Used by both rule-based fallback and LLM (when LLM omits code).
 */
function buildCppCode({
  drivers,
  rules,
  lang,
  sensorModel,
  sensorGpio,
  channels,
  isBME,
  isPIR,
  isHCSR04,
  board,
}) {
  const cppLines = [];
  const esp = lang === 'es';

  // ── Includes ──
  cppLines.push('#include <iotech.hpp>');
  cppLines.push('');

  // ── Driver declarations ──
  for (const d of drivers) {
    if (d.model === 'RELAY') {
      for (const ch of d.channels || []) {
        cppLines.push(
          `Relay ${ch.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()}(${ch.gpio}, "${ch.name}");`
        );
      }
    } else if (d.model === 'BME280') {
      cppLines.push(`BME280 bme(${d.i2c_addr || '0x76'});`);
    } else if (d.model === 'PIR') {
      cppLines.push(`PIR pir(${d.gpio});`);
    } else if (d.model === 'HC-SR04') {
      cppLines.push(`HC_SR04 hcsr04(${d.gpio}, ${d.gpio2});`);
    } else if (d.model === 'BUZZER') {
      cppLines.push(`Buzzer buzzer(${d.gpio});`);
    } else if (d.model !== 'RELAY') {
      const varName = d.model.toLowerCase().replace(/[^a-z0-9]/g, '_');
      cppLines.push(`${d.model} ${varName}(${d.gpio || d.i2c_addr || ''});`);
    }
  }
  cppLines.push('');

  // ── setup() ──
  cppLines.push('void setup() {');
  for (const d of drivers) {
    if (d.model === 'RELAY') {
      for (const ch of d.channels || []) {
        cppLines.push(`    ${ch.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()}.begin();`);
      }
    } else if (d.model === 'BME280') {
      cppLines.push('    bme.begin();');
    } else if (d.model === 'PIR') {
      cppLines.push('    pir.begin();');
    } else if (d.model === 'HC-SR04') {
      cppLines.push('    hcsr04.begin();');
    } else if (d.model === 'BUZZER') {
      cppLines.push('    buzzer.begin();');
    } else if (d.model !== 'RELAY') {
      cppLines.push(`    ${d.model.toLowerCase().replace(/[^a-z0-9]/g, '_')}.begin();`);
    }
  }
  cppLines.push('}');
  cppLines.push('');

  // ── loop() ──
  cppLines.push('void loop() {');
  // Read sensor
  if (sensorModel === 'BME280') {
    cppLines.push('    float temp = bme.readTemperature();');
    cppLines.push('    float hum  = bme.readHumidity();');
    cppLines.push('    float pres = bme.readPressure();');
  } else if (sensorModel === 'PIR') {
    cppLines.push('    bool motion = pir.motionDetected();');
  } else if (sensorModel === 'HC-SR04') {
    cppLines.push('    float dist = hcsr04.readDistance();');
  } else if (sensorModel === 'DHT22') {
    cppLines.push('    float temp = dht22.readTemperature();');
    cppLines.push('    float hum  = dht22.readHumidity();');
  }

  // Rules as if-statements
  for (const rule of rules) {
    const cond = rule.condition;
    const dsKey = cond.datastream;
    let varExpr;
    if (dsKey === 'temperature') varExpr = 'temp';
    else if (dsKey === 'humidity') varExpr = 'hum';
    else if (dsKey === 'pressure') varExpr = 'pres';
    else if (dsKey === 'motion') varExpr = 'motion';
    else if (dsKey === 'distance') varExpr = 'dist';
    else continue;

    cppLines.push(`    if (${varExpr} ${cond.operator} ${cond.value}) {`);
    for (const action of rule.actions) {
      if (action.type === 'relay' && action.relay) {
        const relayCh = channels.find((c) => c.num === action.relay);
        if (relayCh) {
          const varName = relayCh.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
          cppLines.push(`        ${varName}.${action.state === 'on' ? 'on' : 'off'}();`);
        }
      } else if (action.type === 'buzzer') {
        cppLines.push(`        buzzer.beep(${action.tone || 1000}, 500);`);
      }
    }
    cppLines.push('    }');
  }

  cppLines.push('    delay(2000);');
  cppLines.push('}');

  return cppLines.join('\n');
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

  // Detect OLED display (SH1106 or SSD1306)
  const isOLED = lower.includes('sh1106') || lower.includes('ssd1306') || lower.includes('oled');
  const isLCD = lower.includes('lcd1602') || lower.includes('lcd');
  if (isOLED) {
    const oledModel = lower.includes('sh1106') ? 'SH1106' : 'SSD1306';
    drivers.push({ model: oledModel, i2c_addr: '0x3C' });
  }
  if (isLCD) {
    drivers.push({ model: 'LCD1602_I2C', i2c_addr: '0x27' });
  }

  // Build relay channels using actual board pins — only if user mentioned relays
  const channels = [];
  const userMentionedRelays = relayOn.length > 0 || relayOff.length > 0;
  if (userMentionedRelays) {
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

  // Add display wiring if present
  const hasOLED = drivers.some((d) => d.model === 'SH1106' || d.model === 'SSD1306');
  const hasLCD = drivers.some((d) => d.model === 'LCD1602_I2C');
  if (hasOLED) {
    const oled = drivers.find((d) => d.model === 'SH1106' || d.model === 'SSD1306');
    lines.push(
      `ESP32 GPIO${board.pins.i2c_sda} (SDA) → ${oled.model} SDA`,
      `ESP32 GPIO${board.pins.i2c_scl} (SCL) → ${oled.model} SCL`,
      `ESP32 3.3V → ${oled.model} VCC`,
      `ESP32 GND → ${oled.model} GND`
    );
  }
  if (hasLCD) {
    lines.push(
      `ESP32 GPIO${board.pins.i2c_sda} (SDA) → LCD1602 SDA`,
      `ESP32 GPIO${board.pins.i2c_scl} (SCL) → LCD1602 SCL`,
      `ESP32 5V → LCD1602 VCC`,
      `ESP32 GND → LCD1602 GND`
    );
  }

  const displayTag = hasOLED ? ' + OLED' : hasLCD ? ' + LCD' : '';

  const tplName =
    lang === 'es'
      ? channels.length > 0
        ? `Control con ${sensorModel} ${channels.length}CH${displayTag}`
        : `Sensor ${sensorModel}${displayTag}`
      : channels.length > 0
        ? `${sensorModel} Control ${channels.length}CH${displayTag}`
        : `${sensorModel} Sensor${displayTag}`;

  const extraDesc = hasOLED ? ' + OLED' : hasLCD ? ' + LCD' : '';

  return {
    template: {
      name: tplName,
      description:
        lang === 'es'
          ? `Template generado: ${sensorModel} + ${channels.length} relays${extraDesc}`
          : `Generated template: ${sensorModel} + ${channels.length} relays${extraDesc}`,
    },
    drivers,
    datastreams,
    rules,
    diagrama: lines.join('\\n'),
    code: buildCppCode({
      drivers,
      rules,
      lang,
      sensorModel,
      sensorGpio,
      channels,
      isBME,
      isPIR,
      isHCSR04,
      board,
    }),
    _fallback: true,
  };
}

/**
 * Main configure function — tries LLM first, falls back to rules.
 */
async function configure(prompt, boardId) {
  const llmResult = await callLLM(prompt, boardId);
  const raw = llmResult && llmResult.template ? llmResult : ruleBasedConfig(prompt, boardId);

  // If the LLM didn't return code (or we fell back to rules), generate it from config
  if (!raw.code && raw.drivers && raw.drivers.length > 0) {
    const board =
      (boardId && require('./context/board-context').getBoard(boardId)) || getDefaultBoard();
    const lang = detectLanguage(prompt);
    raw.code = buildCppCode({
      drivers: raw.drivers,
      rules: raw.rules || [],
      lang,
      sensorModel: raw.drivers[0].model,
      sensorGpio: raw.drivers[0].gpio,
      channels: raw.drivers.find((d) => d.model === 'RELAY')?.channels || [],
      isBME: raw.drivers.some((d) => d.model === 'BME280'),
      isPIR: raw.drivers.some((d) => d.model === 'PIR'),
      isHCSR04: raw.drivers.some((d) => d.model === 'HC-SR04'),
      board,
    });
  }

  // Ensure code always starts with the include directive
  if (raw.code && !raw.code.trimStart().startsWith('#include <iotech.hpp>')) {
    raw.code = '#include <iotech.hpp>\n\n' + raw.code.trimStart();
  }

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
 * Parse C++ code back into JSON config — regex fallback.
 * Extracts driver instantiations, GPIO pins, and rule logic.
 */
function regexParseCpp(code, _board) {
  const drivers = [];
  const datastreams = [];
  const rules = [];
  const lines = [];

  // Match: DHT22 dht(32);
  const driverRegex =
    /(DHT22|BME280|Relay|PIR|HC_SR04|Buzzer|SSD1306|LCD1602|WS2812B|Servo|DS18B20)\s+(\w+)\(([^)]*)\)/g;
  let match;
  const pinUsage = {};
  while ((match = driverRegex.exec(code)) !== null) {
    const model = match[1];
    const instanceName = match[2];
    const args = match[3];

    if (model === 'Relay') {
      const pinMatch = args.match(/(\d+)/);
      const nameMatch = args.match(/"([^"]+)"/);
      if (pinMatch) {
        const gpio = parseInt(pinMatch[1]);
        const name = nameMatch ? nameMatch[1] : `Relay ${gpio}`;
        const channelNum = drivers.filter((d) => d.model === 'RELAY').length + 1;
        drivers.push({ model: 'RELAY', channels: [{ num: channelNum, gpio, name }] });
        datastreams.push({
          key: `relay${channelNum}`,
          name,
          type: 'string',
          unit: null,
          direction: 'output',
          driver_name: 'RELAY',
          gpio,
          i2c_addr: null,
          config: { channel: channelNum },
        });
        if (pinUsage[gpio]) pinUsage[gpio].push(model);
        else pinUsage[gpio] = [model];
      }
    } else if (model === 'BME280') {
      const addrMatch = args.match(/0x([0-9a-fA-F]+)/);
      const addr = addrMatch ? `0x${addrMatch[1]}` : '0x76';
      drivers.push({ model: 'BME280', i2c_addr: addr });
      datastreams.push(
        {
          key: 'temperature',
          name: 'Temperatura',
          type: 'number',
          unit: '°C',
          direction: 'input',
          driver_name: 'BME280',
          gpio: null,
          i2c_addr: addr,
          config: {},
        },
        {
          key: 'humidity',
          name: 'Humedad',
          type: 'number',
          unit: '%',
          direction: 'input',
          driver_name: 'BME280',
          gpio: null,
          i2c_addr: addr,
          config: {},
        },
        {
          key: 'pressure',
          name: 'Presión',
          type: 'number',
          unit: 'hPa',
          direction: 'input',
          driver_name: 'BME280',
          gpio: null,
          i2c_addr: addr,
          config: {},
        }
      );
    } else {
      const pinMatch = args.match(/(\d+)/);
      if (pinMatch) {
        const gpio = parseInt(pinMatch[1]);
        drivers.push({ model, gpio });
        if (pinUsage[gpio]) pinUsage[gpio].push(model);
        else pinUsage[gpio] = [model];
        if (model === 'DHT22') {
          datastreams.push(
            {
              key: 'temperature',
              name: 'Temperatura',
              type: 'number',
              unit: '°C',
              direction: 'input',
              driver_name: 'DHT22',
              gpio,
              i2c_addr: null,
              config: {},
            },
            {
              key: 'humidity',
              name: 'Humedad',
              type: 'number',
              unit: '%',
              direction: 'input',
              driver_name: 'DHT22',
              gpio,
              i2c_addr: null,
              config: {},
            }
          );
        } else if (model === 'PIR') {
          datastreams.push({
            key: 'motion',
            name: 'Movimiento',
            type: 'boolean',
            unit: null,
            direction: 'input',
            driver_name: 'PIR',
            gpio,
            i2c_addr: null,
            config: {},
          });
        } else if (model === 'HC_SR04') {
          datastreams.push({
            key: 'distance',
            name: 'Distancia',
            type: 'number',
            unit: 'cm',
            direction: 'input',
            driver_name: 'HC-SR04',
            gpio,
            i2c_addr: null,
            config: {},
          });
        } else if (model === 'DS18B20') {
          datastreams.push({
            key: 'temperature',
            name: 'Temperatura',
            type: 'number',
            unit: '°C',
            direction: 'input',
            driver_name: 'DS18B20',
            gpio,
            i2c_addr: null,
            config: {},
          });
        }
      }
    }
  }

  // Detect rule logic: if (instance.method() op val) { instance.on/off() }
  const ruleRegex = /if\s*\(\s*(\w+)\.(\w+)\(\)\s*([<>=!]+)\s*([\d.]+)\s*\)\s*\{([^}]+)\}/g;
  while ((match = ruleRegex.exec(code)) !== null) {
    const instanceName = match[1];
    const methodName = match[2];
    const operator = match[3];
    const value = parseFloat(match[4]);
    const body = match[5];

    // Find which datastream this instance corresponds to
    let dsKey = null;
    for (const ds of datastreams) {
      if (
        ds.key === methodName.toLowerCase().replace('read', '').replace('motiondetected', 'motion')
      )
        break;
      dsKey = ds.key;
    }
    // Simple heuristic: method name → datastream key
    const methodLower = methodName.toLowerCase();
    if (methodLower.includes('temperature')) dsKey = 'temperature';
    else if (methodLower.includes('humidity')) dsKey = 'humidity';
    else if (methodLower.includes('pressure')) dsKey = 'pressure';
    else if (methodLower.includes('motion')) dsKey = 'motion';
    else if (methodLower.includes('distance')) dsKey = 'distance';
    else dsKey = methodLower.replace('read', '').replace('get', '');

    const actions = [];
    const onOffRegex = /(\w+)\.(on|off)\(\)/g;
    let actMatch;
    while ((actMatch = onOffRegex.exec(body)) !== null) {
      const relayInstance = actMatch[1];
      const state = actMatch[2];
      // Find relay number
      const relayInfo = drivers.find((d) => d.model === 'RELAY' && d.channels);
      if (relayInfo) {
        for (const ch of relayInfo.channels) {
          // Approximate: match by being in the same rule
          actions.push({ type: 'relay', relay: ch.num, state });
        }
      }
    }

    if (dsKey && actions.length > 0 && !isNaN(value)) {
      rules.push({
        name: dsKey.charAt(0).toUpperCase() + dsKey.slice(1),
        description: '',
        condition: { datastream: dsKey, operator, value },
        actions: actions.slice(0, 1), // Take first matched action
        cooldown_seconds: 60,
      });
    }
  }

  const driverNames = [...new Set(drivers.map((d) => d.model))].join(' + ');

  // Build connection diagram from parsed drivers
  const diagramLines = [];
  for (const d of drivers) {
    if (d.model === 'BME280' || d.model === 'SSD1306' || d.model === 'LCD1602') {
      diagramLines.push(`ESP32 GPIO21 (SDA) → ${d.model} SDA`);
      diagramLines.push(`ESP32 GPIO22 (SCL) → ${d.model} SCL`);
      diagramLines.push(`ESP32 3.3V → ${d.model} VCC`);
      diagramLines.push(`ESP32 GND → ${d.model} GND`);
    } else if (d.model === 'DHT22') {
      diagramLines.push(`ESP32 GPIO${d.gpio} → DHT22 DAT`);
      diagramLines.push(`ESP32 3.3V → DHT22 VCC`);
      diagramLines.push(`ESP32 GND → DHT22 GND`);
      diagramLines.push('⚠️ Pull-up 10K entre VCC y DAT');
    } else if (d.model === 'PIR') {
      diagramLines.push(`ESP32 GPIO${d.gpio} → PIR OUT`);
      diagramLines.push(`PIR VCC → 5V`);
      diagramLines.push(`PIR GND → GND`);
    } else if (d.model === 'HC-SR04') {
      diagramLines.push(`ESP32 GPIO${d.gpio} → HC-SR04 TRIG`);
      diagramLines.push(`ESP32 GPIO${d.gpio2} → HC-SR04 ECHO`);
      diagramLines.push(`HC-SR04 VCC → 5V`);
      diagramLines.push(`HC-SR04 GND → GND`);
    } else if (d.model === 'BUZZER') {
      diagramLines.push(`ESP32 GPIO${d.gpio} → Buzzer I/O`);
      diagramLines.push(`Buzzer VCC → 3.3V`);
      diagramLines.push(`Buzzer GND → GND`);
    } else if (d.model === 'SERVO' || d.model === 'Servo') {
      diagramLines.push(`ESP32 GPIO${d.gpio} → Servo señal`);
      diagramLines.push(`Servo rojo → 5V`);
      diagramLines.push(`Servo marrón → GND`);
    } else if (d.model === 'DS18B20') {
      diagramLines.push(`ESP32 GPIO${d.gpio} → DS18B20 DAT`);
      diagramLines.push(`ESP32 3.3V → DS18B20 VCC`);
      diagramLines.push(`ESP32 GND → DS18B20 GND`);
      diagramLines.push('⚠️ Pull-up 4.7K entre VCC y DAT');
    } else if (d.model === 'WS2812B') {
      diagramLines.push(`ESP32 GPIO${d.gpio} → WS2812B DAT`);
      diagramLines.push(`WS2812B VCC → 5V (fuente externa)`);
      diagramLines.push(`WS2812B GND → GND`);
    }
  }
  // Relay connections
  for (const d of drivers) {
    if (d.model === 'RELAY' && d.channels) {
      for (const ch of d.channels) {
        diagramLines.push(`ESP32 GPIO${ch.gpio} → ${ch.name}`);
      }
    }
  }

  return {
    template: { name: `Config from code (${driverNames})`, description: 'Parsed from C++' },
    drivers,
    datastreams,
    rules,
    diagrama: diagramLines.join('\\n'),
    diagnostics: {
      drivers: drivers.map((d) => d.model),
      pinConflicts: Object.entries(pinUsage)
        .filter(([, v]) => v.length > 1)
        .map(([k, v]) => ({ gpio: parseInt(k), drivers: v })),
      rulesDetected: rules.length,
    },
  };
}

/**
 * Sync: parse C++ code back into JSON config.
 * Tries LLM first, falls back to regex parser.
 */
async function syncFromCpp(code, boardId) {
  const board =
    (boardId && require('./context/board-context').getBoard(boardId)) || getDefaultBoard();

  // Try LLM first
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (apiKey) {
    const syncPrompt = [
      'You are parsing iotech C++ code. Extract the JSON configuration.',
      'Look for: driver instantiations (DHT22, Relay, BME280, etc.), GPIO pins,',
      'if/else conditions with .on()/.off() actions, and wiring.',
      'Return ONLY valid JSON matching the iotech config schema.',
    ].join(' ');

    try {
      const res = await fetch(
        `${process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'}/v1/chat/completions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
            messages: [
              { role: 'system', content: syncPrompt },
              { role: 'user', content: `Parse this C++ code:\n\n${code}` },
            ],
            temperature: 0.1,
            max_tokens: 2000,
            response_format: { type: 'json_object' },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          try {
            const parsed = JSON.parse(content);
            const validation = validateAiConfig(parsed);
            if (!validation.error) {
              return { ...validation.value, _source: 'ai' };
            }
          } catch (e) {
            /* fall through to regex */
          }
        }
      }
    } catch (err) {
      logger.warn(`[ai.service] LLM sync failed, falling back to regex: ${err.message}`);
    }
  }

  // Regex fallback
  const parsed = regexParseCpp(code, board);
  const validation = validateAiConfig(parsed);
  if (validation.error) {
    logger.error(`[ai.service] Regex sync produced invalid config: ${validation.error}`);
    throw new ValidationError(validation.error);
  }
  return { ...validation.value, _source: 'regex-fallback' };
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

module.exports = { configure, apply, getCatalog, getSystemPrompt, syncFromCpp, regexParseCpp };
