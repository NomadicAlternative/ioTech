'use strict';

/**
 * Dynamic prompt builder for the iotech AI assistant.
 *
 * Assembles a context-rich system prompt from:
 * - Board pin maps (board-context.js)
 * - Driver catalog metadata (driver-catalog.js)
 * - Few-shot examples (examples.js)
 * - Rules format documentation
 *
 * Language detection:
 * - Detects Spanish vs English from the user's input
 * - Generates the system prompt in the detected language
 * - Examples are included in the detected language
 */

const { getDefaultBoard } = require('./board-context');
const { listDrivers, isCompatibleWithBoard } = require('./driver-catalog');
const { getExamples } = require('./examples');

/**
 * Simple language detection based on Spanish keyword presence.
 * @param {string} text
 * @returns {'es' | 'en'}
 */
function detectLanguage(text) {
  const lower = text.toLowerCase();
  // Strong Spanish indicators — multi-character, uncommon in English
  const spanishIndicators = [
    'quiero',
    'necesito',
    'tengo',
    'conectar',
    'usar',
    'temperatura',
    'humedad',
    'cuando',
    'activar',
    'apagar',
    'encender',
    'para',
    'como',
    'pero',
    'más',
    'menos',
    'grados',
    'medir',
    'controlar',
    'configurar',
    'instalador',
    // accented characters are strong signals
    'ñ',
    'á',
    'é',
    'í',
    'ó',
    'ú',
    'ü',
  ];
  const matchCount = spanishIndicators.filter((w) => lower.includes(w)).length;
  return matchCount >= 1 ? 'es' : 'en';
}

// ── Bilingual text blocks ────────────────────────────────────────────────

const TEXTS = {
  role: {
    es: 'Eres un asistente de configuración para iotech, una plataforma IoT B2B2C.',
    en: 'You are a configuration assistant for iotech, a B2B2C IoT platform.',
  },
  task: {
    es: 'Tu trabajo: dado lo que describe un instalador, devolvé un JSON con la configuración del dispositivo.\n\nEl firmware de iotech es GENÉRICO — usa drivers activables por configuración. No necesitás generar código C, solo describir qué drivers activar y con qué pines.',
    en: "Your job: given an installer's description, return a JSON with the device configuration.\n\niotech firmware is GENERIC — it uses configuration-activatable drivers. You don't need to generate C code, just describe which drivers to activate and with which pins.",
  },
  boardContext: {
    es: '## Placa seleccionada: {boardName}\n\n{boardDescription}\n\n### Pines GPIO disponibles\n{pinMap}\n\n### Restricciones\n{constraints}',
    en: '## Selected Board: {boardName}\n\n{boardDescription}\n\n### Available GPIO Pins\n{pinMap}\n\n### Constraints\n{constraints}',
  },
  driverContext: {
    es: '## Drivers disponibles en esta placa\n\n{driverList}',
    en: '## Available Drivers on This Board\n\n{driverList}',
  },
  driverDetail: {
    es: '### {model} — {description}\n- Protocolo: {protocol}\n- Pines necesarios: {pinsNeeded}\n- Datastreams generados: {datastreams}\n- Cableado: {wiring}\n- Notas: {notes}',
    en: '### {model} — {description}\n- Protocol: {protocol}\n- Pins needed: {pinsNeeded}\n- Generated datastreams: {datastreams}\n- Wiring: {wiring}\n- Notes: {notes}',
  },
  relayPinMap: {
    es: '- Relés disponibles: {relays}',
    en: '- Available relays: {relays}',
  },
  rulesSection: {
    es: `## Reglas de automatización

Las reglas tienen:
- **condition**: { datastream, operator, value } — el datastream es el "key" del sensor (ej: "temperature", "humidity", "distance", "motion", "pressure", "relay1")
- **operator**: ">", ">=", "<", "<=", "==", "!="
- **actions**: array de { type, relay?, state?, ... } — type puede ser "relay", "buzzer", "servo", "ws2812b_fill"
- **cooldown_seconds**: mínimo entre ejecuciones (default: 60)

Para relay: { type: "relay", relay: número de relay (1-8), state: "on"|"off" }
Para buzzer: { type: "buzzer", tone: frecuencia en Hz }
Para servo: { type: "servo", angle: grados 0-180 }`,
    en: `## Automation Rules

Rules have:
- **condition**: { datastream, operator, value } — datastream is the sensor "key" (e.g.: "temperature", "humidity", "distance", "motion", "pressure", "relay1")
- **operator**: ">", ">=", "<", "<=", "==", "!="
- **actions**: array of { type, relay?, state?, ... } — type can be "relay", "buzzer", "servo", "ws2812b_fill"
- **cooldown_seconds**: minimum between executions (default: 60)

For relay: { type: "relay", relay: relay number (1-8), state: "on"|"off" }
For buzzer: { type: "buzzer", tone: frequency in Hz }
For servo: { type: "servo", angle: degrees 0-180 }`,
  },
  cppSdk: {
    es: `## SDK C++ (iotech.hpp)

Además del JSON de configuración, DEBÉS generar código C++ que use las clases de iotech.hpp.
El código sigue una estructura Arduino-style con setup() y loop().

### Clases disponibles

| Clase | Constructor | Métodos de lectura |
|---|---|---|
| DHT22 | DHT22(pin) | begin(), readTemperature(), readHumidity() |
| Relay | Relay(pin, nombre) | begin(), on(), off(), state() |
| BME280 | BME280(addr=0x76) | begin(), readTemperature(), readHumidity(), readPressure() |
| PIR | PIR(pin) | begin(), motionDetected() |
| HC_SR04 | HC_SR04(trig, echo) | begin(), readDistance() |
| Buzzer | Buzzer(pin) | begin(), beep(freq, ms) |
| SSD1306 | SSD1306(addr=0x3C) | begin(), print(texto, linea), clear() |
| LCD1602 | LCD1602(addr=0x27) | begin(), print(texto, linea), clear(), setBacklight(bool) |
| WS2812B | WS2812B(pin, numLeds) | begin(), fill(r,g,b), set(i,r,g,b) |
| Servo | Servo(pin) | begin(), setAngle(grados) |
| DS18B20 | DS18B20(pin) | begin(), readTemperature() |

Utilidad global: delay(ms) — espera milisegundos.

### Reglas del código C++
1. Declará los objetos como variables globales (fuera de setup/loop).
2. En setup(), llamá begin() en cada objeto.
3. En loop(), leé sensores y aplicá la lógica con if/else.
4. Usá delay() para controlar la frecuencia de muestreo.
5. Nombres de variables descriptivos y en español.
6. Comentarios en español explicando la lógica.
7. Usá SOLO los GPIOs de la placa (ver arriba).`,
    en: `## C++ SDK (iotech.hpp)

In addition to the JSON configuration, you MUST generate C++ code using the iotech.hpp classes.
The code follows an Arduino-style structure with setup() and loop().

### Available Classes

| Class | Constructor | Read/Command Methods |
|---|---|---|
| DHT22 | DHT22(pin) | begin(), readTemperature(), readHumidity() |
| Relay | Relay(pin, name) | begin(), on(), off(), state() |
| BME280 | BME280(addr=0x76) | begin(), readTemperature(), readHumidity(), readPressure() |
| PIR | PIR(pin) | begin(), motionDetected() |
| HC_SR04 | HC_SR04(trig, echo) | begin(), readDistance() |
| Buzzer | Buzzer(pin) | begin(), beep(freq, ms) |
| SSD1306 | SSD1306(addr=0x3C) | begin(), print(text, line), clear() |
| LCD1602 | LCD1602(addr=0x27) | begin(), print(text, line), clear(), setBacklight(bool) |
| WS2812B | WS2812B(pin, numLeds) | begin(), fill(r,g,b), set(i,r,g,b) |
| Servo | Servo(pin) | begin(), setAngle(degrees) |
| DS18B20 | DS18B20(pin) | begin(), readTemperature() |

Global utility: delay(ms) — wait milliseconds.

### C++ Code Rules
1. Declare objects as global variables (outside setup/loop).
2. In setup(), call begin() on each object.
3. In loop(), read sensors and apply logic with if/else.
4. Use delay() to control sampling frequency.
5. Descriptive variable names.
6. Comments explaining the logic.
7. Use ONLY the board GPIOs (see above).`,
  },
  outputFormat: {
    es: `## Formato de respuesta OBLIGATORIO

Respondé ÚNICAMENTE con este JSON. Nada de texto extra, ni markdown, ni explicaciones.

{
  "template": {
    "name": "Nombre descriptivo en español",
    "description": "Qué hace este dispositivo"
  },
  "drivers": [
    { "model": "DHT22", "gpio": 32 },
    { "model": "RELAY", "channels": [
      { "num": 1, "gpio": 23, "name": "Nombre del relay" }
    ]}
  ],
  "datastreams": [
    {
      "key": "temperature",
      "name": "Temperatura",
      "type": "number",
      "unit": "°C",
      "direction": "input",
      "driver_name": "DHT22",
      "gpio": 32,
      "i2c_addr": null,
      "config": {}
    }
  ],
  "rules": [
    {
      "name": "Nombre de la regla",
      "description": "Qué hace",
      "condition": { "datastream": "temperature", "operator": ">=", "value": 30 },
      "actions": [{ "type": "relay", "relay": 1, "state": "on" }],
      "cooldown_seconds": 60
    }
  ],
  "diagrama": "ESP32 GPIO32 → DHT22 DAT\\nESP32 3.3V → DHT22 VCC\\n...",
  "code": "DHT22 dht(32);\\nRelay bomba(23, \\"Bomba\\");\\n\\nvoid setup() {\\n  dht.begin();\\n  bomba.begin();\\n}\\n\\nvoid loop() {\\n  float t = dht.readTemperature();\\n  if (t >= 30.0) { bomba.on(); }\\n  delay(2000);\\n}"
}

REGLAS:
1. Usá SOLO este formato JSON de respuesta. Nada de texto extra.
2. El array "drivers" es OBLIGATORIO.
3. Para relays, especificá channels (array con num + gpio + name).
4. Para sensores I2C, usá i2c_addr (ej: "0x76" para BME280).
5. I2C por defecto: SDA y SCL según la placa (ver pines arriba).
6. Las reglas usan datastream keys (ej: "temperature", "relay1").
7. Incluí SIEMPRE "diagrama" con las conexiones físicas detalladas (pin por pin).
8. El nombre del template en español, descriptivo, basado en lo que hace.
9. Los relays se numeran de 1 a N.
10. Cada datastream DEBE incluir: driver_name (máx 16 chars, nombre del driver), gpio (número o null), i2c_addr (string o null), config (objeto o null).
11. Respetá EXACTAMENTE los pines GPIO de la placa (ver arriba). No inventes pines.
12. NO uses pines que estén marcados como NO DISPONIBLES en la placa.
13. El campo "code" DEBE contener código C++ válido usando las clases de iotech.hpp.
14. El código C++ debe reflejar EXACTAMENTE los drivers, pines y reglas de la configuración JSON.`,
    en: `## REQUIRED Response Format

Respond ONLY with this JSON. No extra text, markdown, or explanations.

{
  "template": {
    "name": "Descriptive name in English",
    "description": "What this device does"
  },
  "drivers": [
    { "model": "DHT22", "gpio": 32 },
    { "model": "RELAY", "channels": [
      { "num": 1, "gpio": 23, "name": "Relay name" }
    ]}
  ],
  "datastreams": [
    {
      "key": "temperature",
      "name": "Temperature",
      "type": "number",
      "unit": "°C",
      "direction": "input",
      "driver_name": "DHT22",
      "gpio": 32,
      "i2c_addr": null,
      "config": {}
    }
  ],
  "rules": [
    {
      "name": "Rule name",
      "description": "What it does",
      "condition": { "datastream": "temperature", "operator": ">=", "value": 30 },
      "actions": [{ "type": "relay", "relay": 1, "state": "on" }],
      "cooldown_seconds": 60
    }
  ],
  "diagrama": "ESP32 GPIO32 → DHT22 DAT\\nESP32 3.3V → DHT22 VCC\\n...",
  "code": "DHT22 dht(32);\\nRelay pump(23, \\"Pump\\");\\n\\nvoid setup() {\\n  dht.begin();\\n  pump.begin();\\n}\\n\\nvoid loop() {\\n  float t = dht.readTemperature();\\n  if (t >= 30.0) { pump.on(); }\\n  delay(2000);\\n}"
}

RULES:
1. Use ONLY this JSON response format. No extra text.
2. The "drivers" array is MANDATORY.
3. For relays, specify channels (array with num + gpio + name).
4. For I2C sensors, use i2c_addr (e.g.: "0x76" for BME280).
5. Default I2C: SDA and SCL according to the board (see pins above).
6. Rules use datastream keys (e.g.: "temperature", "relay1").
7. ALWAYS include "diagrama" with detailed physical connections (pin by pin).
8. Template name in English, descriptive, based on what it does.
9. Relays are numbered 1 to N.
10. Each datastream MUST include: driver_name (max 16 chars, driver name), gpio (number or null), i2c_addr (string or null), config (object or null).
11. Respect EXACTLY the board GPIO pins (see above). Do not invent pins.
12. DO NOT use pins marked as UNAVAILABLE on the board.
13. The "code" field MUST contain valid C++ code using the iotech.hpp classes.
14. The C++ code must EXACTLY reflect the drivers, pins, and rules from the JSON configuration.`,
  },
  examplesTitle: {
    es: '## Ejemplos de configuraciones reales que funcionan\n\n{examples}',
    en: '## Examples of Real Working Configurations\n\n{examples}',
  },
  exampleItem: {
    es: '### Ejemplo: {title}\n\n**Usuario dice**: "{userPrompt}"\n\n**Respuesta correcta**:\n```json\n{config}\n```',
    en: '### Example: {title}\n\n**User says**: "{userPrompt}"\n\n**Correct response**:\n```json\n{config}\n```',
  },
  languageInstruction: {
    es: '\n\n⚠️ IMPORTANTE: El instalador habla en español. Respondé con nombres y descripciones en español. Los diagramas y nombres de template en español.',
    en: '\n\n⚠️ IMPORTANT: The installer speaks English. Respond with names and descriptions in English. Template names and diagrams in English.',
  },

  // ── AI Context Knowledge (from ai-context/esp32/) ──────────────────
  esp32Knowledge: {
    es: `## Conocimiento Técnico ESP32

### Modelos y recomendaciones
- **ESP32 DevKit V1**: Plataforma principal. 34 GPIOs (26 usables). Strapping: evitar GPIO 0,2,5,12,15. Input-only: GPIO 34-39. Flash: GPIO 6-11 reservados.
- **ESP32-S3**: RECOMENDADO para nuevas instalaciones. USB-C nativo, más GPIOs (36 usables), sin pines input-only, BLE 5.0. LEDC 14-bit (no 16-bit).
- **ESP32-C3**: Opción económica. RISC-V single-core. Solo 2 UARTs (sin UART2). Sin RMT RX. DS18B20 y Buzzer no disponibles.
- **ESP32-CAM**: Muy limitado. Solo DHT22 + I2C + relays parciales. Sin servo, PIR, HC-SR04, WS2812B.
- **ESP32-S2 y C6**: NO SOPORTADOS. No generes código para ellos.

### Reglas de GPIO (OBLIGATORIO)
Antes de asignar cualquier pin, verificá:
1. ¿El pin es SAFE, WARNING o FORBIDDEN para esta placa?
2. ¿Hay conflicto con otro driver en el mismo pin?
3. ¿El periférico existe en esta placa? (ej: UART2 no existe en C3)
4. ¿Los pines I2C son los correctos para esta placa?
5. Strapping pins (GPIO 0,2,5,12,15 en ESP32) requieren confirmación.

### Drivers y compatibilidad
| Driver | ESP32 | S3 | C3 | CAM |
|---|---|---|---|---|
| DHT22 | ✅ | ✅ | ✅ | ✅ |
| BME280 | ✅ | ✅ | ✅ | ✅ |
| RELAY | ✅ | ✅ | ✅ | ⚠️ 7ch |
| PIR | ✅ | ✅ | ✅ | ❌ |
| HC-SR04 | ✅ | ✅ | ⚠️ timer | ❌ |
| Buzzer | ✅ | ✅ | ❌ | ❌ |
| DS18B20 | ✅ | ✅ | ❌ | ❌ |
| WS2812B | ✅ | ✅ | ✅ | ❌ |
| SERVO | ✅ | ✅ | ✅ | ❌ |
| SSD1306/LCD1602 | ✅ | ✅ | ✅ | ✅ |`,

    en: `## ESP32 Technical Knowledge

### Models and recommendations
- **ESP32 DevKit V1**: Primary platform. 34 GPIOs (26 usable). Strapping: avoid GPIO 0,2,5,12,15. Input-only: GPIO 34-39. Flash: GPIO 6-11 reserved.
- **ESP32-S3**: RECOMMENDED for new installs. Native USB-C, more GPIOs (36 usable), no input-only pins, BLE 5.0. LEDC 14-bit (not 16-bit).
- **ESP32-C3**: Budget option. RISC-V single-core. Only 2 UARTs (no UART2). No RMT RX. DS18B20 and Buzzer unavailable.
- **ESP32-CAM**: Very constrained. Only DHT22 + I2C + partial relays. No servo, PIR, HC-SR04, WS2812B.
- **ESP32-S2 and C6**: NOT SUPPORTED. Do not generate code for them.

### GPIO Rules (MANDATORY)
Before assigning any pin, verify:
1. Is this pin SAFE, WARNING, or FORBIDDEN for this board?
2. Is there a conflict with another driver on the same pin?
3. Does the peripheral exist on this board? (e.g., UART2 does not exist on C3)
4. Are I2C pins correct for this board?
5. Strapping pins (GPIO 0,2,5,12,15 on ESP32) require confirmation.

### Driver compatibility
| Driver | ESP32 | S3 | C3 | CAM |
|---|---|---|---|---|
| DHT22 | ✅ | ✅ | ✅ | ✅ |
| BME280 | ✅ | ✅ | ✅ | ✅ |
| RELAY | ✅ | ✅ | ✅ | ⚠️ 7ch |
| PIR | ✅ | ✅ | ✅ | ❌ |
| HC-SR04 | ✅ | ✅ | ⚠️ timer | ❌ |
| Buzzer | ✅ | ✅ | ❌ | ❌ |
| DS18B20 | ✅ | ✅ | ❌ | ❌ |
| WS2812B | ✅ | ✅ | ✅ | ❌ |
| SERVO | ✅ | ✅ | ✅ | ❌ |
| SSD1306/LCD1602 | ✅ | ✅ | ✅ | ✅ |`,
  },

  firmwareRules: {
    es: `## Reglas de Firmware (OBLIGATORIO)

### Lo que SÍ debe hacer el código generado:
- Usar SOLO clases de <iotech.hpp> (DHT22, Relay, BME280, etc.)
- Inicializar drivers en setup() con .begin()
- Leer sensores y evaluar reglas en loop()
- Usar delay() de iotech (es vTaskDelay, no bloquea)

### Lo que NUNCA debe hacer el código generado:
- NO usar #include <Arduino.h> — usar #include <iotech.hpp>
- NO usar pinMode() ni digitalWrite() — usar clases de iotech
- NO usar WiFi.begin() — el framework maneja WiFi
- NO usar client.publish() — el framework maneja MQTT
- NO usar while(true) — bloquea el scheduler, watchdog reinicia
- NO usar delay() de Arduino — solo el delay() de iotech.hpp
- NO hardcodear topics MQTT — el framework los genera
- NO declarar drivers dentro de loop() — deben ser globales`,

    en: `## Firmware Rules (MANDATORY)

### What generated code MUST do:
- Use ONLY <iotech.hpp> classes (DHT22, Relay, BME280, etc.)
- Initialize drivers in setup() with .begin()
- Read sensors and evaluate rules in loop()
- Use iotech's delay() (it's vTaskDelay, non-blocking)

### What generated code MUST NEVER do:
- DO NOT use #include <Arduino.h> — use #include <iotech.hpp>
- DO NOT use pinMode() or digitalWrite() — use iotech classes
- DO NOT use WiFi.begin() — framework manages WiFi
- DO NOT use client.publish() — framework manages MQTT
- DO NOT use while(true) — blocks scheduler, watchdog resets
- DO NOT use Arduino delay() — only iotech.hpp delay()
- DO NOT hardcode MQTT topics — framework generates them
- DO NOT declare drivers inside loop() — must be global`,
  },
};

// ── Build functions ──────────────────────────────────────────────────────

/**
 * Build a human-readable pin map for a board.
 * @param {object} board - from board-context
 * @param {string} lang - 'es' or 'en'
 * @returns {string}
 */
function buildPinMap(board, lang) {
  const labels = {
    dht: { es: 'DHT22/DHT11 (datos)', en: 'DHT22/DHT11 (data)' },
    i2c: { es: 'I2C (SDA/SCL)', en: 'I2C (SDA/SCL)' },
    one_wire: { es: 'DS18B20 (1-wire)', en: 'DS18B20 (1-wire)' },
    pir: { es: 'PIR (movimiento)', en: 'PIR (motion)' },
    hcsr04: { es: 'HC-SR04 (trigger/echo)', en: 'HC-SR04 (trigger/echo)' },
    ws2812b: { es: 'WS2812B (LED RGB)', en: 'WS2812B (RGB LED)' },
    servo: { es: 'Servo (PWM)', en: 'Servo (PWM)' },
    buzzer: { es: 'Buzzer', en: 'Buzzer' },
  };

  const lines = [];

  // Sensor pins
  if (board.pins.dht !== undefined) {
    const val = board.pins.dht;
    const label = val === 0xff ? { es: 'NO DISPONIBLE', en: 'NOT AVAILABLE' }[lang] : `GPIO${val}`;
    lines.push(`- ${labels.dht[lang]}: ${label}`);
  }

  const i2cLabel =
    board.pins.i2c_sda !== undefined
      ? `GPIO${board.pins.i2c_sda}/GPIO${board.pins.i2c_scl}`
      : 'N/A';
  lines.push(`- ${labels.i2c[lang]}: ${i2cLabel}`);

  if (board.pins.one_wire !== undefined) {
    const val = board.pins.one_wire;
    const label = val === 0xff ? { es: 'NO DISPONIBLE', en: 'NOT AVAILABLE' }[lang] : `GPIO${val}`;
    lines.push(`- ${labels.one_wire[lang]}: ${label}`);
  }

  if (board.pins.pir !== undefined) {
    const val = board.pins.pir;
    const label = val === 0xff ? { es: 'NO DISPONIBLE', en: 'NOT AVAILABLE' }[lang] : `GPIO${val}`;
    lines.push(`- ${labels.pir[lang]}: ${label}`);
  }

  if (board.pins.hcsr04_trig !== undefined) {
    const trigVal = board.pins.hcsr04_trig;
    const echoVal = board.pins.hcsr04_echo;
    if (trigVal === 0xff) {
      lines.push(`- ${labels.hcsr04[lang]}: ${{ es: 'NO DISPONIBLE', en: 'NOT AVAILABLE' }[lang]}`);
    } else {
      lines.push(`- ${labels.hcsr04[lang]}: GPIO${trigVal} (trig) / GPIO${echoVal} (echo)`);
    }
  }

  if (board.pins.ws2812b !== undefined) {
    const val = board.pins.ws2812b;
    const label = val === 0xff ? { es: 'NO DISPONIBLE', en: 'NOT AVAILABLE' }[lang] : `GPIO${val}`;
    lines.push(`- ${labels.ws2812b[lang]}: ${label}`);
  }

  if (board.pins.servo !== undefined) {
    const val = board.pins.servo;
    const label = val === 0xff ? { es: 'NO DISPONIBLE', en: 'NOT AVAILABLE' }[lang] : `GPIO${val}`;
    lines.push(`- ${labels.servo[lang]}: ${label}`);
  }

  if (board.pins.buzzer !== undefined) {
    const val = board.pins.buzzer;
    const label = val === 0xff ? { es: 'NO DISPONIBLE', en: 'NOT AVAILABLE' }[lang] : `GPIO${val}`;
    lines.push(`- ${labels.buzzer[lang]}: ${label}`);
  }

  // Relay pins
  if (board.pins.relays) {
    const relayList = board.pins.relays
      .filter((r) => r.gpio !== 0xff)
      .map((r) => {
        const name = r.name ? ` (${r.name})` : '';
        return `Relay${r.num}=GPIO${r.gpio}${name}`;
      })
      .join(', ');
    lines.push('');
    lines.push({ es: '**Relays (active LOW)**', en: '**Relays (active LOW)**' }[lang]);
    lines.push(`- ${relayList}`);

    const unavailable = board.pins.relays.filter((r) => r.gpio === 0xff);
    if (unavailable.length > 0) {
      const names = unavailable.map((r) => `Relay ${r.num}`).join(', ');
      lines.push(`- ${{ es: 'NO DISPONIBLES:', en: 'NOT AVAILABLE:' }[lang]} ${names}`);
    }
  }

  return lines.join('\n');
}

/**
 * Build driver documentation for a specific board.
 * Only includes drivers compatible with the board.
 * @param {object} board
 * @param {string} lang
 * @returns {string}
 */
function buildDriverList(board, lang) {
  const drivers = listDrivers();
  const compatible = drivers.filter((d) => isCompatibleWithBoard(d, board.id));

  const entries = compatible.map((d) => {
    const desc = d.description[lang];
    const protocol = d.protocol;
    const pinsNeeded = d.pins_needed ? d.pins_needed.map((p) => p.label[lang]).join(', ') : 'None';

    let datastreams = '';
    if (d.datastreams && d.datastreams.length > 0) {
      datastreams = d.datastreams
        .map((ds) => `${ds.key} (${ds.name[lang]}, ${ds.type}, ${ds.unit || 'N/A'})`)
        .join(', ');
    } else if (d.model === 'RELAY') {
      datastreams =
        'relay1..relayN (string: "on"|"off", output) — generados dinámicamente por canal';
    } else {
      datastreams =
        lang === 'es'
          ? 'N/A (solo actuador, no genera lecturas)'
          : 'N/A (actuator only, no readings)';
    }

    return TEXTS.driverDetail[lang]
      .replace('{model}', d.model)
      .replace('{description}', desc)
      .replace('{protocol}', protocol)
      .replace('{pinsNeeded}', pinsNeeded)
      .replace('{datastreams}', datastreams)
      .replace('{wiring}', d.wiring ? d.wiring[lang] : 'N/A')
      .replace('{notes}', d.notes ? d.notes[lang] : '');
  });

  return entries.join('\n\n');
}

/**
 * Build few-shot examples section.
 * @param {string} boardId
 * @param {string} lang
 * @param {number} [maxExamples=2]
 * @returns {string}
 */
function buildExamples(boardId, lang, maxExamples = 2) {
  // Get examples for this board, plus one generic fallback
  const boardExamples = getExamples({ board: boardId }).slice(0, maxExamples);

  if (boardExamples.length === 0) {
    // Fall back to ESP32_DEVKIT examples
    const fallback = getExamples({ board: 'ESP32_DEVKIT' }).slice(0, maxExamples);
    return buildExampleItems(fallback, lang);
  }

  return buildExampleItems(boardExamples, lang);
}

function buildExampleItems(examples, lang) {
  return examples
    .map((ex) => {
      const templateName = ex.config.template.name;
      const userPrompt = ex.user[lang];
      const configJson = JSON.stringify(ex.config, null, 2);

      return TEXTS.exampleItem[lang]
        .replace('{title}', templateName)
        .replace('{userPrompt}', userPrompt)
        .replace('{config}', configJson);
    })
    .join('\n\n');
}

// ── Main entry point ─────────────────────────────────────────────────────

/**
 * Build the complete system prompt for the AI configuration assistant.
 *
 * @param {object} options
 * @param {string} options.userPrompt - the installer's natural language input
 * @param {string} [options.boardId] - board ID (default: 'ESP32_DEVKIT')
 * @param {number} [options.maxExamples] - number of few-shot examples (default: 2)
 * @returns {string} - the assembled system prompt
 */
function buildSystemPrompt({ userPrompt, boardId, maxExamples = 2 } = {}) {
  const lang = detectLanguage(userPrompt || '');
  const board = (boardId && require('./board-context').getBoard(boardId)) || getDefaultBoard();
  const boardIdActual = board.id;

  const pinMap = buildPinMap(board, lang);
  const constraints =
    board.constraints && board.constraints[lang]
      ? board.constraints[lang].map((c) => `- ${c}`).join('\n')
      : '';

  const boardContext = TEXTS.boardContext[lang]
    .replace('{boardName}', board.name)
    .replace('{boardDescription}', board.description[lang])
    .replace('{pinMap}', pinMap)
    .replace('{constraints}', constraints);

  const driverList = buildDriverList(board, lang);
  const driverContext = TEXTS.driverContext[lang].replace('{driverList}', driverList);

  const rulesSection = TEXTS.rulesSection[lang];
  const cppSdkSection = TEXTS.cppSdk ? TEXTS.cppSdk[lang] : '';
  const esp32Knowledge = TEXTS.esp32Knowledge ? TEXTS.esp32Knowledge[lang] : '';
  const firmwareRules = TEXTS.firmwareRules ? TEXTS.firmwareRules[lang] : '';
  const outputFormat = TEXTS.outputFormat[lang];
  const languageInstruction = TEXTS.languageInstruction[lang];

  const examples = buildExamples(boardIdActual, lang, maxExamples);
  let examplesSection = '';
  if (examples) {
    examplesSection = '\n\n' + TEXTS.examplesTitle[lang].replace('{examples}', examples);
  }

  return [
    TEXTS.role[lang],
    TEXTS.task[lang],
    boardContext,
    esp32Knowledge,
    firmwareRules,
    driverContext,
    cppSdkSection,
    rulesSection,
    outputFormat,
    examplesSection,
    languageInstruction,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Build the user prompt (the actual query sent to the LLM).
 *
 * @param {string} input - the installer's raw input
 * @param {string} lang - detected language
 * @returns {string}
 */
function buildUserPrompt(input, lang) {
  if (lang === 'es') {
    return `Instalador dice: "${input}"\n\nGenerá la configuración JSON según el formato especificado.`;
  }
  return `Installer says: "${input}"\n\nGenerate the JSON configuration according to the specified format.`;
}

module.exports = { buildSystemPrompt, buildUserPrompt, detectLanguage };
