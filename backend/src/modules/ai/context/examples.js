'use strict';

/**
 * Few-shot examples — real, working iotech configurations.
 *
 * These are validated configurations that the AI can use as reference.
 * Each example includes:
 * - User prompt (es + en versions)
 * - Expected configuration output
 *
 * When adding examples, validate them against ai.schemas.js first.
 */

const EXAMPLES = [
  // ── Example 1: DHT22 + Relay thermal control (KNOWN WORKING) ──────
  {
    id: 'dht22-thermal-control',
    tags: ['DHT22', 'RELAY', 'temperature', 'threshold', 'ESP32_DEVKIT'],
    board: 'ESP32_DEVKIT',
    user: {
      es: 'Tengo un ESP32 con un DHT22 para medir temperatura. Cuando la temperatura supere los 30°C, quiero que se active el relay 1 para encender un ventilador.',
      en: 'I have an ESP32 with a DHT22 to measure temperature. When the temperature exceeds 30°C, I want relay 1 to turn on a fan.',
    },
    config: {
      template: {
        name: 'Control Térmico con DHT22',
        description:
          'Monitoreo de temperatura con DHT22 y control de ventilador vía relay. Activa relay 1 cuando temperatura >= 30°C.',
      },
      drivers: [
        { model: 'DHT22', gpio: 32 },
        { model: 'RELAY', channels: [{ num: 1, gpio: 23, name: 'Ventilador' }] },
      ],
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
        {
          key: 'humidity',
          name: 'Humedad',
          type: 'number',
          unit: '%',
          direction: 'input',
          driver_name: 'DHT22',
          gpio: 32,
          i2c_addr: null,
          config: {},
        },
        {
          key: 'relay1',
          name: 'Ventilador',
          type: 'string',
          unit: null,
          direction: 'output',
          driver_name: 'RELAY',
          gpio: 23,
          i2c_addr: null,
          config: { channel: 1 },
        },
      ],
      rules: [
        {
          name: 'Activar ventilador a 30°C',
          description:
            'Enciende el ventilador cuando la temperatura supera 30°C y lo apaga cuando baja de 28°C.',
          condition: { datastream: 'temperature', operator: '>=', value: 30 },
          actions: [{ type: 'relay', relay: 1, state: 'on' }],
          cooldown_seconds: 120,
        },
      ],
      diagrama:
        'ESP32 GPIO32 → DHT22 DAT\nESP32 3.3V → DHT22 VCC\nESP32 GND → DHT22 GND\n⚠️ Pull-up 10K entre VCC y DAT\nESP32 GPIO23 → Relay 1 IN1\nRelay 1 VCC → 5V\nRelay 1 GND → GND',
      code: 'DHT22 dht(32);\nRelay ventilador(23, "Ventilador");\n\nvoid setup() {\n  dht.begin();\n  ventilador.begin();\n}\n\nvoid loop() {\n  float temp = dht.readTemperature();\n  float hum = dht.readHumidity();\n  if (temp >= 30.0) {\n    ventilador.on();\n  } else {\n    ventilador.off();\n  }\n  delay(2000);\n}',
    },
  },

  // ── Example 2: BME280 weather station with multiple relays ────────
  {
    id: 'bme280-weather-station',
    tags: ['BME280', 'RELAY', 'pressure', 'I2C', 'ESP32_DEVKIT'],
    board: 'ESP32_DEVKIT',
    user: {
      es: 'Quiero una estación meteorológica con BME280 que mida temperatura, humedad y presión. Además necesito 2 relays: uno para una bomba de riego y otro para una luz UV. Que la bomba se active si la humedad baja de 30% y la luz UV cuando la presión supere 1013 hPa.',
      en: 'I want a weather station with BME280 measuring temperature, humidity and pressure. Also need 2 relays: one for an irrigation pump and one for a UV light. The pump should activate if humidity drops below 30% and the UV light when pressure exceeds 1013 hPa.',
    },
    config: {
      template: {
        name: 'Estación Meteorológica BME280',
        description:
          'Monitoreo ambiental con BME280 (T/H/P) y control de riego + luz UV vía 2 relays.',
      },
      drivers: [
        { model: 'BME280', i2c_addr: '0x76' },
        {
          model: 'RELAY',
          channels: [
            { num: 1, gpio: 23, name: 'Bomba de riego' },
            { num: 2, gpio: 22, name: 'Luz UV' },
          ],
        },
      ],
      datastreams: [
        {
          key: 'temperature',
          name: 'Temperatura',
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
          name: 'Humedad',
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
          name: 'Presión',
          type: 'number',
          unit: 'hPa',
          direction: 'input',
          driver_name: 'BME280',
          gpio: null,
          i2c_addr: '0x76',
          config: {},
        },
        {
          key: 'relay1',
          name: 'Bomba de riego',
          type: 'string',
          unit: null,
          direction: 'output',
          driver_name: 'RELAY',
          gpio: 23,
          i2c_addr: null,
          config: { channel: 1 },
        },
        {
          key: 'relay2',
          name: 'Luz UV',
          type: 'string',
          unit: null,
          direction: 'output',
          driver_name: 'RELAY',
          gpio: 22,
          i2c_addr: null,
          config: { channel: 2 },
        },
      ],
      rules: [
        {
          name: 'Riego por baja humedad',
          description: 'Activa la bomba de riego cuando la humedad baja del 30%',
          condition: { datastream: 'humidity', operator: '<', value: 30 },
          actions: [{ type: 'relay', relay: 1, state: 'on' }],
          cooldown_seconds: 1800,
        },
        {
          name: 'Luz UV por alta presión',
          description: 'Activa la luz UV cuando la presión supera 1013 hPa',
          condition: { datastream: 'pressure', operator: '>=', value: 1013 },
          actions: [{ type: 'relay', relay: 2, state: 'on' }],
          cooldown_seconds: 600,
        },
      ],
      diagrama:
        'ESP32 GPIO21 (SDA) → BME280 SDA\nESP32 GPIO22 (SCL) → BME280 SCL\nESP32 3.3V → BME280 VCC\nESP32 GND → BME280 GND\nESP32 GPIO23 → Relay 1 IN1 (Bomba)\nESP32 GPIO22 → Relay 2 IN2 (Luz UV)',
      code: 'BME280 bme(0x76);\nRelay bomba(23, "Bomba de riego");\nRelay luzUV(22, "Luz UV");\n\nvoid setup() {\n  bme.begin();\n  bomba.begin();\n  luzUV.begin();\n}\n\nvoid loop() {\n  float hum = bme.readHumidity();\n  float pres = bme.readPressure();\n  if (hum < 30.0) { bomba.on(); } else { bomba.off(); }\n  if (pres >= 1013.0) { luzUV.on(); } else { luzUV.off(); }\n  delay(2000);\n}',
    },
  },

  // ── Example 3: PIR motion sensor + buzzer alarm ──────────────────
  {
    id: 'pir-buzzer-alarm',
    tags: ['PIR', 'BUZZER', 'motion', 'alarm', 'ESP32_DEVKIT'],
    board: 'ESP32_DEVKIT',
    user: {
      es: 'Necesito una alarma de movimiento. Un sensor PIR que detecte cuando alguien entra y active un buzzer.',
      en: 'I need a motion alarm. A PIR sensor that detects when someone enters and activates a buzzer.',
    },
    config: {
      template: {
        name: 'Alarma de Movimiento PIR',
        description: 'Detección de movimiento con PIR HC-SR501 y alarma sonora con buzzer.',
      },
      drivers: [
        { model: 'PIR', gpio: 27 },
        { model: 'BUZZER', gpio: 13 },
      ],
      datastreams: [
        {
          key: 'motion',
          name: 'Movimiento',
          type: 'boolean',
          unit: null,
          direction: 'input',
          driver_name: 'PIR',
          gpio: 27,
          i2c_addr: null,
          config: {},
        },
      ],
      rules: [
        {
          name: 'Alarma por movimiento',
          description: 'Activa el buzzer cuando se detecta movimiento',
          condition: { datastream: 'motion', operator: '==', value: 1 },
          actions: [{ type: 'buzzer', tone: 1000 }],
          cooldown_seconds: 30,
        },
      ],
      diagrama:
        'ESP32 GPIO27 → PIR OUT\nPIR VCC → 5V\nPIR GND → GND\nESP32 GPIO13 → Buzzer I/O\nBuzzer VCC → 3.3V\nBuzzer GND → GND',
      code: 'PIR pir(27);\nBuzzer buzzer(13);\n\nvoid setup() {\n  pir.begin();\n  buzzer.begin();\n}\n\nvoid loop() {\n  if (pir.motionDetected()) {\n    buzzer.beep(1000, 500);\n  }\n  delay(500);\n}',
    },
  },

  // ── Example 4: HC-SR04 distance sensor + relay ────────────────────
  {
    id: 'hcsr04-distance-relay',
    tags: ['HC-SR04', 'RELAY', 'distance', 'ESP32_DEVKIT'],
    board: 'ESP32_DEVKIT',
    user: {
      es: 'Quiero medir el nivel de agua de un tanque con un HC-SR04. Cuando el nivel baje de 50cm (distancia mayor a 50cm), que se active una bomba con relay 1.',
      en: 'I want to measure water level in a tank with an HC-SR04. When the level drops below 50cm (distance greater than 50cm), activate a pump with relay 1.',
    },
    config: {
      template: {
        name: 'Control de Nivel de Agua HC-SR04',
        description: 'Medición ultrasónica de nivel de agua y control de bomba vía relay.',
      },
      drivers: [
        { model: 'HC-SR04', gpio: 33, gpio2: 34 },
        { model: 'RELAY', channels: [{ num: 1, gpio: 23, name: 'Bomba de agua' }] },
      ],
      datastreams: [
        {
          key: 'distance',
          name: 'Distancia',
          type: 'number',
          unit: 'cm',
          direction: 'input',
          driver_name: 'HC-SR04',
          gpio: 33,
          i2c_addr: null,
          config: {},
        },
        {
          key: 'relay1',
          name: 'Bomba de agua',
          type: 'string',
          unit: null,
          direction: 'output',
          driver_name: 'RELAY',
          gpio: 23,
          i2c_addr: null,
          config: { channel: 1 },
        },
      ],
      rules: [
        {
          name: 'Llenar tanque cuando nivel bajo',
          description: 'Activa la bomba cuando la distancia al agua supera 50cm (nivel bajo)',
          condition: { datastream: 'distance', operator: '>=', value: 50 },
          actions: [{ type: 'relay', relay: 1, state: 'on' }],
          cooldown_seconds: 300,
        },
      ],
      diagrama:
        'ESP32 GPIO33 → HC-SR04 TRIG\nESP32 GPIO34 → HC-SR04 ECHO\nHC-SR04 VCC → 5V\nHC-SR04 GND → GND\nESP32 GPIO23 → Relay 1 IN1\nRelay VCC → 5V\nRelay GND → GND',
    },
  },

  // ── Example 5: ESP32-C3 with DHT22 + relay ────────────────────────
  {
    id: 'esp32c3-dht22-relay',
    tags: ['DHT22', 'RELAY', 'ESP32_C3'],
    board: 'ESP32_C3',
    user: {
      es: 'Tengo un ESP32-C3 con un DHT22. Quiero controlar un calefactor con relay 1 cuando la temperatura baje de 18°C.',
      en: 'I have an ESP32-C3 with a DHT22. I want to control a heater with relay 1 when the temperature drops below 18°C.',
    },
    config: {
      template: {
        name: 'Control de Calefacción C3',
        description: 'Control de calefactor con DHT22 y relay en ESP32-C3.',
      },
      drivers: [
        { model: 'DHT22', gpio: 0 },
        { model: 'RELAY', channels: [{ num: 1, gpio: 10, name: 'Calefactor' }] },
      ],
      datastreams: [
        {
          key: 'temperature',
          name: 'Temperatura',
          type: 'number',
          unit: '°C',
          direction: 'input',
          driver_name: 'DHT22',
          gpio: 0,
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
          gpio: 0,
          i2c_addr: null,
          config: {},
        },
        {
          key: 'relay1',
          name: 'Calefactor',
          type: 'string',
          unit: null,
          direction: 'output',
          driver_name: 'RELAY',
          gpio: 10,
          i2c_addr: null,
          config: { channel: 1 },
        },
      ],
      rules: [
        {
          name: 'Calefacción por baja temperatura',
          description: 'Enciende el calefactor cuando la temperatura baja de 18°C',
          condition: { datastream: 'temperature', operator: '<', value: 18 },
          actions: [{ type: 'relay', relay: 1, state: 'on' }],
          cooldown_seconds: 300,
        },
      ],
      diagrama:
        'ESP32-C3 GPIO0 → DHT22 DAT\nESP32-C3 3.3V → DHT22 VCC\nESP32-C3 GND → DHT22 GND\n⚠️ Pull-up 10K entre VCC y DAT\nESP32-C3 GPIO10 → Relay 1 IN1',
    },
  },
];

/**
 * Get all examples, optionally filtered by tag or board.
 * @param {object} [filters]
 * @param {string} [filters.board] - e.g. 'ESP32_DEVKIT'
 * @param {string} [filters.tag] - e.g. 'DHT22'
 * @returns {object[]}
 */
function getExamples(filters = {}) {
  let results = EXAMPLES;

  if (filters.board) {
    results = results.filter((ex) => ex.board === filters.board);
  }

  if (filters.tag) {
    const tag = filters.tag.toUpperCase();
    results = results.filter((ex) => ex.tags.includes(tag));
  }

  return results;
}

/**
 * Get example count.
 * @returns {number}
 */
function getExampleCount() {
  return EXAMPLES.length;
}

module.exports = { EXAMPLES, getExamples, getExampleCount };
