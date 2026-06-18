'use strict';

/**
 * Driver catalog — metadata for every supported sensor, actuator, and display.
 *
 * KEEP IN SYNC with firmware/components/drivers/
 * When a new driver is implemented, add its entry here.
 *
 * Each driver entry documents:
 * - Protocol and wiring requirements
 * - Generated datastreams (keys, types, units)
 * - Accepted commands (for actuators)
 * - Connection templates with pin wiring
 */

const DRIVERS = {
  DHT22: {
    model: 'DHT22',
    category: 'sensor',
    description: {
      es: 'Sensor digital de temperatura y humedad de precisión (±0.5°C, ±2% RH). Muestreo cada 2 segundos.',
      en: 'Precision digital temperature and humidity sensor (±0.5°C, ±2% RH). Sampling every 2 seconds.',
    },
    protocol: '1-wire',
    pins_needed: [{ name: 'gpio', label: { es: 'GPIO de datos', en: 'Data GPIO' } }],
    datastreams: [
      {
        key: 'temperature',
        name: { es: 'Temperatura', en: 'Temperature' },
        type: 'number',
        unit: '°C',
        direction: 'input',
      },
      {
        key: 'humidity',
        name: { es: 'Humedad', en: 'Humidity' },
        type: 'number',
        unit: '%',
        direction: 'input',
      },
    ],
    wiring: {
      es: 'VCC → 3.3V | DAT → GPIO{data} | GND → GND | ⚠️ Pull-up 10K entre VCC y DAT',
      en: 'VCC → 3.3V | DAT → GPIO{data} | GND → GND | ⚠️ 10K pull-up between VCC and DAT',
    },
    notes: {
      es: 'Requiere resistor pull-up de 10KΩ entre VCC y datos. No muestrear más de una vez cada 2 segundos.',
      en: 'Requires 10KΩ pull-up resistor between VCC and data. Do not sample more than once every 2 seconds.',
    },
  },

  BME280: {
    model: 'BME280',
    category: 'sensor',
    description: {
      es: 'Sensor ambiental I2C: temperatura, humedad, presión atmosférica y altitud calculada.',
      en: 'I2C environmental sensor: temperature, humidity, atmospheric pressure, and calculated altitude.',
    },
    protocol: 'I2C',
    pins_needed: [{ name: 'i2c_addr', label: { es: 'Dirección I2C', en: 'I2C address' } }],
    default_i2c_addr: '0x76',
    alternate_i2c_addr: '0x77',
    datastreams: [
      {
        key: 'temperature',
        name: { es: 'Temperatura', en: 'Temperature' },
        type: 'number',
        unit: '°C',
        direction: 'input',
      },
      {
        key: 'humidity',
        name: { es: 'Humedad', en: 'Humidity' },
        type: 'number',
        unit: '%',
        direction: 'input',
      },
      {
        key: 'pressure',
        name: { es: 'Presión', en: 'Pressure' },
        type: 'number',
        unit: 'hPa',
        direction: 'input',
      },
    ],
    wiring: {
      es: 'VCC → 3.3V | SDA → GPIO{i2c_sda} | SCL → GPIO{i2c_scl} | GND → GND',
      en: 'VCC → 3.3V | SDA → GPIO{i2c_sda} | SCL → GPIO{i2c_scl} | GND → GND',
    },
    notes: {
      es: 'Dirección I2C por defecto: 0x76 (cambiar a 0x77 si SDO a VCC). Los pines SDA/SCL se toman del board.',
      en: 'Default I2C address: 0x76 (change to 0x77 if SDO to VCC). SDA/SCL pins come from the board config.',
    },
  },

  DS18B20: {
    model: 'DS18B20',
    category: 'sensor',
    description: {
      es: 'Sensor de temperatura digital Dallas 1-wire. Rango -55°C a 125°C. Puede encadenar múltiples sensores en un solo pin.',
      en: 'Dallas 1-wire digital temperature sensor. Range -55°C to 125°C. Can chain multiple sensors on one pin.',
    },
    protocol: '1-wire Dallas',
    pins_needed: [{ name: 'gpio', label: { es: 'GPIO de datos', en: 'Data GPIO' } }],
    datastreams: [
      {
        key: 'temperature',
        name: { es: 'Temperatura', en: 'Temperature' },
        type: 'number',
        unit: '°C',
        direction: 'input',
      },
    ],
    wiring: {
      es: 'VCC → 3.3V | DAT → GPIO{data} | GND → GND | ⚠️ Pull-up 4.7K entre VCC y DAT',
      en: 'VCC → 3.3V | DAT → GPIO{data} | GND → GND | ⚠️ 4.7K pull-up between VCC and DAT',
    },
    notes: {
      es: 'Requiere resistor pull-up de 4.7KΩ. Cada sensor tiene ID único de 64-bit. No disponible en ESP32-C3 ni ESP32-CAM.',
      en: 'Requires 4.7KΩ pull-up resistor. Each sensor has a unique 64-bit ID. Not available on ESP32-C3 or ESP32-CAM.',
    },
    board_blacklist: ['ESP32_C3', 'ESP32_CAM'],
  },

  PIR: {
    model: 'PIR',
    category: 'sensor',
    description: {
      es: 'Sensor de movimiento infrarrojo HC-SR501. Detección digital: HIGH cuando hay movimiento.',
      en: 'HC-SR501 infrared motion sensor. Digital detection: HIGH when motion detected.',
    },
    protocol: 'GPIO digital',
    pins_needed: [{ name: 'gpio', label: { es: 'GPIO de señal', en: 'Signal GPIO' } }],
    datastreams: [
      {
        key: 'motion',
        name: { es: 'Movimiento', en: 'Motion' },
        type: 'boolean',
        unit: null,
        direction: 'input',
      },
    ],
    wiring: {
      es: 'VCC → 5V | OUT → GPIO{data} | GND → GND',
      en: 'VCC → 5V | OUT → GPIO{data} | GND → GND',
    },
    notes: {
      es: 'Alimentar con 5V (no 3.3V). Tiene potenciómetros para ajustar sensibilidad y tiempo de disparo.',
      en: 'Power with 5V (not 3.3V). Has potentiometers to adjust sensitivity and trigger time.',
    },
    board_blacklist: ['ESP32_CAM'],
  },

  'HC-SR04': {
    model: 'HC-SR04',
    category: 'sensor',
    description: {
      es: 'Sensor de distancia ultrasónico. Rango 2cm a 4 metros. Necesita 2 pines GPIO (trigger + echo).',
      en: 'Ultrasonic distance sensor. Range 2cm to 4 meters. Needs 2 GPIO pins (trigger + echo).',
    },
    protocol: 'GPIO trigger/echo',
    pins_needed: [
      { name: 'gpio', label: { es: 'GPIO Trigger', en: 'Trigger GPIO' } },
      { name: 'gpio2', label: { es: 'GPIO Echo', en: 'Echo GPIO' } },
    ],
    datastreams: [
      {
        key: 'distance',
        name: { es: 'Distancia', en: 'Distance' },
        type: 'number',
        unit: 'cm',
        direction: 'input',
      },
    ],
    wiring: {
      es: 'VCC → 5V | TRIG → GPIO{trig} | ECHO → GPIO{echo} | GND → GND',
      en: 'VCC → 5V | TRIG → GPIO{trig} | ECHO → GPIO{echo} | GND → GND',
    },
    notes: {
      es: 'Alimentar con 5V. Echo pin debe ser input-capable (GPIO 34-39 en DevKit son solo input — ideal para echo). En C3, echo usa timer fallback (sin RMT RX). No disponible en ESP32-CAM.',
      en: 'Power with 5V. Echo pin must be input-capable (GPIO 34-39 on DevKit are input-only — ideal for echo). On C3, echo uses timer fallback (no RMT RX). Not available on ESP32-CAM.',
    },
    board_blacklist: ['ESP32_CAM'],
  },

  RELAY: {
    model: 'RELAY',
    category: 'actuator',
    description: {
      es: 'Módulo de relés 1-8 canales. Control on/off para cargas de alta potencia (luces, bombas, calefactores). Active LOW.',
      en: '1-8 channel relay module. On/off control for high-power loads (lights, pumps, heaters). Active LOW.',
    },
    protocol: 'GPIO digital',
    pins_needed: [
      {
        name: 'channels',
        label: { es: 'Canales (1-8)', en: 'Channels (1-8)' },
        array: true,
        min: 1,
        max: 8,
      },
    ],
    datastreams: [], // dynamic: relay1..relayN generated per channel
    commands: [{ action: 'relay', params: { relay: 'number (1-N)', state: '"on"|"off"' } }],
    wiring: {
      es: 'VCC → 3.3V o 5V (según módulo) | IN1..IN8 → GPIOs de relays | GND → GND',
      en: 'VCC → 3.3V or 5V (depending on module) | IN1..IN8 → Relay GPIOs | GND → GND',
    },
    notes: {
      es: '⚠️ ACTIVE LOW: GPIO en LOW = relay ACTIVADO, GPIO en HIGH = relay APAGADO. Cada canal genera un datastream "relayN" de tipo string ("on"|"off").',
      en: '⚠️ ACTIVE LOW: GPIO LOW = relay ON, GPIO HIGH = relay OFF. Each channel generates a "relayN" datastream of type string ("on"|"off").',
    },
  },

  WS2812B: {
    model: 'WS2812B',
    category: 'actuator',
    description: {
      es: 'Tira LED RGB direccionable (Neopixel). Control individual de color por LED. Usa RMT del ESP32.',
      en: 'Addressable RGB LED strip (Neopixel). Individual color control per LED. Uses ESP32 RMT peripheral.',
    },
    protocol: 'GPIO (RMT)',
    pins_needed: [
      { name: 'gpio', label: { es: 'GPIO de datos', en: 'Data GPIO' } },
      { name: 'channels', label: { es: 'Número de LEDs', en: 'Number of LEDs' }, min: 1 },
    ],
    datastreams: [], // actuator only (no read)
    commands: [
      { action: 'ws2812b_fill', params: { r: '0-255', g: '0-255', b: '0-255' } },
      { action: 'ws2812b_set', params: { index: 'LED index', r: '0-255', g: '0-255', b: '0-255' } },
    ],
    wiring: {
      es: 'VCC → 5V (externo para tiras largas) | DAT → GPIO{data} | GND → GND',
      en: 'VCC → 5V (external for long strips) | DAT → GPIO{data} | GND → GND',
    },
    notes: {
      es: 'Requiere fuente externa 5V para más de unos pocos LEDs. No disponible en ESP32-CAM.',
      en: 'Requires external 5V power supply for more than a few LEDs. Not available on ESP32-CAM.',
    },
    board_blacklist: ['ESP32_CAM'],
  },

  SERVO: {
    model: 'SERVO',
    category: 'actuator',
    description: {
      es: 'Servomotor SG90/MG996R. Control de ángulo 0-180° vía PWM. Útil para válvulas, persianas, dirección.',
      en: 'SG90/MG996R servo motor. Angle control 0-180° via PWM. Useful for valves, blinds, steering.',
    },
    protocol: 'PWM',
    pins_needed: [{ name: 'gpio', label: { es: 'GPIO de señal', en: 'Signal GPIO' } }],
    datastreams: [], // actuator only
    commands: [{ action: 'servo_set', params: { angle: '0-180 degrees' } }],
    wiring: {
      es: 'Rojo → 5V | Naranja/Amarillo → GPIO{data} | Marrón/Negro → GND',
      en: 'Red → 5V | Orange/Yellow → GPIO{data} | Brown/Black → GND',
    },
    notes: {
      es: 'Alimentar con 5V externo si se usa más de un servo. No disponible en ESP32-CAM.',
      en: 'Power with external 5V if using more than one servo. Not available on ESP32-CAM.',
    },
    board_blacklist: ['ESP32_CAM'],
  },

  SSD1306: {
    model: 'SSD1306',
    category: 'display',
    description: {
      es: 'Pantalla OLED 128x64 píxeles monocromo. Conexión I2C. Ideal para mostrar datos en el dispositivo.',
      en: '128x64 pixel monochrome OLED display. I2C connection. Ideal for showing data on-device.',
    },
    protocol: 'I2C',
    pins_needed: [{ name: 'i2c_addr', label: { es: 'Dirección I2C', en: 'I2C address' } }],
    default_i2c_addr: '0x3C',
    datastreams: [], // display only (no read)
    commands: [
      { action: 'ssd1306_text', params: { text: 'string to display' } },
      { action: 'ssd1306_clear', params: {} },
    ],
    wiring: {
      es: 'VCC → 3.3V | SDA → GPIO{i2c_sda} | SCL → GPIO{i2c_scl} | GND → GND',
      en: 'VCC → 3.3V | SDA → GPIO{i2c_sda} | SCL → GPIO{i2c_scl} | GND → GND',
    },
    notes: {
      es: 'Dirección I2C por defecto: 0x3C. Algunos módulos traen 0x3D.',
      en: 'Default I2C address: 0x3C. Some modules use 0x3D.',
    },
  },

  SH1106: {
    model: 'SH1106',
    category: 'display',
    description: {
      es: 'Pantalla OLED 1.3" 128x64 píxeles monocromo. Conexión I2C. Controlador SH1106.',
      en: '1.3" 128x64 pixel monochrome OLED display. I2C connection. SH1106 controller.',
    },
    protocol: 'I2C',
    pins_needed: [{ name: 'i2c_addr', label: { es: 'Dirección I2C', en: 'I2C address' } }],
    default_i2c_addr: '0x3C',
    datastreams: [],
    commands: [
      { action: 'sh1106_text', params: { text: 'string to display' } },
      { action: 'sh1106_clear', params: {} },
    ],
    wiring: {
      es: 'VCC → 3.3V | SDA → GPIO{i2c_sda} | SCL → GPIO{i2c_scl} | GND → GND',
      en: 'VCC → 3.3V | SDA → GPIO{i2c_sda} | SCL → GPIO{i2c_scl} | GND → GND',
    },
    notes: {
      es: 'Display 1.3". Dirección I2C por defecto: 0x3C. Algunos módulos usan 0x3D.',
      en: '1.3" display. Default I2C address: 0x3C. Some modules use 0x3D.',
    },
  },

  LCD1602: {
    model: 'LCD1602',
    category: 'display',
    description: {
      es: 'Pantalla LCD 16x2 caracteres con backlight azul/verde. Conexión I2C via PCF8574. Ideal para mostrar datos en tiempo real.',
      en: '16x2 character LCD with blue/green backlight. I2C connection via PCF8574 backpack. Ideal for real-time data display.',
    },
    protocol: 'I2C',
    pins_needed: [{ name: 'i2c_addr', label: { es: 'Dirección I2C', en: 'I2C address' } }],
    default_i2c_addr: '0x27',
    alternate_i2c_addr: '0x3F',
    datastreams: [], // display only (no sensor readings)
    commands: [
      { action: 'lcd1602_text', params: { text: 'string (max 16 chars)', line: '0 or 1' } },
      { action: 'lcd1602_clear', params: {} },
      { action: 'lcd1602_cursor', params: { col: '0-15', row: '0 or 1' } },
      { action: 'lcd1602_backlight', params: { on: 'true or false' } },
    ],
    wiring: {
      es: 'VCC → 5V | SDA → GPIO{i2c_sda} | SCL → GPIO{i2c_scl} | GND → GND',
      en: 'VCC → 5V | SDA → GPIO{i2c_sda} | SCL → GPIO{i2c_scl} | GND → GND',
    },
    notes: {
      es: 'Dirección I2C por defecto: 0x27 (algunos módulos usan 0x3F). Alimentar con 5V. Muestra 2 líneas de 16 caracteres. Backlight azul controlable.',
      en: 'Default I2C address: 0x27 (some modules use 0x3F). Power with 5V. Shows 2 lines of 16 characters. Blue backlight controllable.',
    },
  },

  BUZZER: {
    model: 'BUZZER',
    category: 'actuator',
    description: {
      es: 'Buzzer activo o pasivo para alarmas sonoras y notificaciones. Control por GPIO digital o PWM para tonos.',
      en: 'Active or passive buzzer for sound alarms and notifications. GPIO digital or PWM control for tones.',
    },
    protocol: 'GPIO digital / PWM',
    pins_needed: [{ name: 'gpio', label: { es: 'GPIO de señal', en: 'Signal GPIO' } }],
    datastreams: [], // actuator only
    commands: [
      { action: 'buzzer_beep', params: { duration_ms: 'duration in ms' } },
      { action: 'buzzer_tone', params: { frequency: 'Hz', duration_ms: 'duration in ms' } },
    ],
    wiring: {
      es: 'VCC → 3.3V | I/O → GPIO{data} | GND → GND',
      en: 'VCC → 3.3V | I/O → GPIO{data} | GND → GND',
    },
    notes: {
      es: 'Buzzer activo solo necesita GPIO HIGH/LOW. Pasivo necesita PWM para tonos. No disponible en ESP32-C3 ni ESP32-CAM.',
      en: 'Active buzzer only needs GPIO HIGH/LOW. Passive needs PWM for tones. Not available on ESP32-C3 or ESP32-CAM.',
    },
    board_blacklist: ['ESP32_C3', 'ESP32_CAM'],
  },
};

/**
 * Get a driver by its model name (case-insensitive).
 * @param {string} model - e.g. 'dht22', 'DHT22', 'relay'
 * @returns {object|null}
 */
function getDriver(model) {
  const key = Object.keys(DRIVERS).find((k) => k.toLowerCase() === model.toLowerCase());
  return key ? DRIVERS[key] : null;
}

/**
 * List all drivers, optionally filtered by category.
 * @param {string} [category] - 'sensor', 'actuator', or 'display'
 * @returns {object[]}
 */
function listDrivers(category) {
  const all = Object.values(DRIVERS);
  if (!category) return all;
  return all.filter((d) => d.category === category);
}

/**
 * Check if a driver is compatible with a given board.
 * @param {object} driver - driver entry from catalog
 * @param {string} boardId - e.g. 'ESP32_CAM'
 * @returns {boolean}
 */
function isCompatibleWithBoard(driver, boardId) {
  if (!driver.board_blacklist) return true;
  return !driver.board_blacklist.includes(boardId);
}

/**
 * Generate datastream entries for a relay driver with N channels.
 * @param {number} numChannels - 1 to 8
 * @returns {object[]}
 */
function generateRelayDatastreams(numChannels) {
  const streams = [];
  for (let i = 1; i <= Math.min(numChannels, 8); i++) {
    streams.push({
      key: `relay${i}`,
      name: { es: `Relé ${i}`, en: `Relay ${i}` },
      type: 'string',
      unit: null,
      direction: 'output',
    });
  }
  return streams;
}

module.exports = {
  DRIVERS,
  getDriver,
  listDrivers,
  isCompatibleWithBoard,
  generateRelayDatastreams,
};
