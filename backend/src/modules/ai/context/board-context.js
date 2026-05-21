'use strict';

/**
 * Board context — GPIO pin maps for all supported ESP32 boards.
 *
 * KEEP IN SYNC with firmware/components/io_board/include/boards/*.h
 * When a new board is added or pins change, update this file.
 *
 * Sentinel value 0xFF means "pin not available" on that board.
 */

const SENTINEL = 0xff;

const BOARDS = {
  ESP32_DEVKIT: {
    id: 'ESP32_DEVKIT',
    name: 'ESP32 DevKit V1',
    description: {
      es: 'Placa principal ESP32 con WiFi + BLE, 30 pines GPIO utilizables. La más común para desarrollo.',
      en: 'Main ESP32 board with WiFi + BLE, 30 usable GPIO pins. Most common for development.',
    },
    chip: 'ESP32',
    pins: {
      dht: 32,
      i2c_sda: 21,
      i2c_scl: 22,
      relays: [
        { num: 1, gpio: 23 },
        { num: 2, gpio: 22 },
        { num: 3, gpio: 21 },
        { num: 4, gpio: 19 },
        { num: 5, gpio: 18 },
        { num: 6, gpio: 5 },
        { num: 7, gpio: 17 },
        { num: 8, gpio: 16 },
      ],
      ws2812b: 25,
      servo: 26,
      pir: 27,
      hcsr04_trig: 33,
      hcsr04_echo: 34,
      one_wire: 4,
      buzzer: 13,
    },
    constraints: {
      es: [
        'GPIO 34-39 son solo entrada (no usar para relays ni salidas)',
        'Relays usan active LOW (GPIO en LOW = relay ACTIVADO)',
        'Evitar GPIO 0, 2, 12, 15 (strapping pins)',
        'Flash usa GPIO 6-11 — no usar',
      ],
      en: [
        'GPIO 34-39 are input-only (do not use for relays or outputs)',
        'Relays use active LOW (GPIO LOW = relay ON)',
        'Avoid GPIO 0, 2, 12, 15 (strapping pins)',
        'Flash uses GPIO 6-11 — do not use',
      ],
    },
  },

  ESP32_S3: {
    id: 'ESP32_S3',
    name: 'ESP32-S3',
    description: {
      es: 'ESP32-S3 con WiFi + BLE + aceleración AI. Soporta cámara y edge ML.',
      en: 'ESP32-S3 with WiFi + BLE + AI acceleration. Supports camera and edge ML.',
    },
    chip: 'ESP32-S3',
    pins: {
      dht: 4,
      i2c_sda: 1,
      i2c_scl: 2,
      relays: [
        { num: 1, gpio: 5 },
        { num: 2, gpio: 6 },
        { num: 3, gpio: 7 },
        { num: 4, gpio: 15 },
        { num: 5, gpio: 16 },
        { num: 6, gpio: 17 },
        { num: 7, gpio: 18 },
        { num: 8, gpio: 8 },
      ],
      ws2812b: 48,
      servo: 9,
      pir: 10,
      hcsr04_trig: 11,
      hcsr04_echo: 12,
      one_wire: 13,
      buzzer: 14,
    },
    constraints: {
      es: [
        'Relays usan active LOW (GPIO en LOW = relay ACTIVADO)',
        'Evitar GPIO 0, 3, 45, 46 (strapping pins)',
      ],
      en: [
        'Relays use active LOW (GPIO LOW = relay ON)',
        'Avoid GPIO 0, 3, 45, 46 (strapping pins)',
      ],
    },
  },

  ESP32_C3: {
    id: 'ESP32_C3',
    name: 'ESP32-C3',
    description: {
      es: 'ESP32-C3 RISC-V con WiFi + BLE, bajo consumo. Sin RMT RX — HC-SR04 usa timer fallback.',
      en: 'ESP32-C3 RISC-V with WiFi + BLE, low power. No RMT RX — HC-SR04 uses timer fallback.',
    },
    chip: 'ESP32-C3',
    pins: {
      dht: 0,
      i2c_sda: 3,
      i2c_scl: 4,
      relays: [
        { num: 1, gpio: 10 },
        { num: 2, gpio: 6 },
        { num: 3, gpio: 7 },
        { num: 4, gpio: 5 },
        { num: 5, gpio: 20 },
        { num: 6, gpio: 21 },
        { num: 7, gpio: 19 },
        { num: 8, gpio: 18 },
      ],
      ws2812b: 8,
      servo: 9,
      pir: 1,
      hcsr04_trig: 2,
      hcsr04_echo: SENTINEL, // No RMT RX — timer fallback, but marked unavailable
      one_wire: SENTINEL,
      buzzer: SENTINEL,
    },
    constraints: {
      es: [
        'Relays usan active LOW (GPIO en LOW = relay ACTIVADO)',
        'Evitar GPIO 2, 8, 9 (strapping pins)',
        'C3 no tiene RMT RX — HC-SR04 limitado a timer fallback',
        'DS18B20 (1-wire) y Buzzer NO disponibles en C3',
      ],
      en: [
        'Relays use active LOW (GPIO LOW = relay ON)',
        'Avoid GPIO 2, 8, 9 (strapping pins)',
        'C3 has no RMT RX — HC-SR04 limited to timer fallback',
        'DS18B20 (1-wire) and Buzzer NOT available on C3',
      ],
    },
  },

  ESP32_CAM: {
    id: 'ESP32_CAM',
    name: 'ESP32-CAM (AI-Thinker)',
    description: {
      es: 'ESP32-CAM con cámara OV2640. Muy limitado en pines — solo DHT22, I2C, y relays parciales.',
      en: 'ESP32-CAM with OV2640 camera. Very pin-constrained — only DHT22, I2C, and partial relays.',
    },
    chip: 'ESP32',
    pins: {
      dht: 33,
      i2c_sda: 13,
      i2c_scl: 12,
      relays: [
        { num: 1, gpio: 2 },
        { num: 2, gpio: 14 },
        { num: 3, gpio: 15 },
        { num: 4, gpio: 4 },
        { num: 5, gpio: 16 },
        { num: 6, gpio: 3 },
        { num: 7, gpio: 1 },
        { num: 8, gpio: SENTINEL },
      ],
      ws2812b: SENTINEL,
      servo: SENTINEL,
      pir: SENTINEL,
      hcsr04_trig: SENTINEL,
      hcsr04_echo: SENTINEL,
      one_wire: SENTINEL,
      buzzer: SENTINEL,
    },
    constraints: {
      es: [
        'Relays usan active LOW (GPIO en LOW = relay ACTIVADO)',
        'SD card + cámara + PSRAM consumen la mayoría de los pines',
        'Sin RMT libre — WS2812B NO disponible',
        'Sin servo, PIR, HC-SR04, DS18B20, ni buzzer disponibles',
        'Solo DHT22 + I2C + relays (parcial)',
      ],
      en: [
        'Relays use active LOW (GPIO LOW = relay ON)',
        'SD card + camera + PSRAM consume most pins',
        'No free RMT — WS2812B NOT available',
        'No servo, PIR, HC-SR04, DS18B20, or buzzer available',
        'Only DHT22 + I2C + relays (partial)',
      ],
    },
  },
};

/**
 * Get a board by its ID.
 * @param {string} boardId - e.g. 'ESP32_DEVKIT'
 * @returns {object|null}
 */
function getBoard(boardId) {
  return BOARDS[boardId] || null;
}

/**
 * List all supported boards.
 * @returns {object[]}
 */
function listBoards() {
  return Object.values(BOARDS);
}

/**
 * Get relay GPIO for a specific relay number (1-indexed) on a board.
 * @param {object} board
 * @param {number} relayNum - 1-indexed relay number
 * @returns {number|null} - GPIO number or null if unavailable
 */
function getRelayGpio(board, relayNum) {
  if (!board || !board.pins || !board.pins.relays) return null;
  const relay = board.pins.relays.find((r) => r.num === relayNum);
  if (!relay || relay.gpio === SENTINEL) return null;
  return relay.gpio;
}

/**
 * Check if a pin capability is available on a board.
 * @param {object} board
 * @param {string} capability - e.g. 'dht', 'one_wire', 'buzzer'
 * @returns {boolean}
 */
function isCapabilityAvailable(board, capability) {
  if (!board || !board.pins) return false;
  const val = board.pins[capability];
  if (val === undefined) return true; // not a known pin capability, assume available
  return val !== SENTINEL;
}

/**
 * Get the default board (ESP32 DevKit V1).
 * @returns {object}
 */
function getDefaultBoard() {
  return BOARDS.ESP32_DEVKIT;
}

module.exports = {
  BOARDS,
  getBoard,
  listBoards,
  getRelayGpio,
  isCapabilityAvailable,
  getDefaultBoard,
  SENTINEL,
};
