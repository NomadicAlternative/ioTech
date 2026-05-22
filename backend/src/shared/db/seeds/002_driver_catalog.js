'use strict';

/**
 * Seed: driver_catalog — Complete registry of ioTech sensors, actuators, and displays.
 *
 * Categories:
 *   firmware_status:
 *     - 'available' → Driver compiled + validated with real hardware
 *     - 'untested'  → Driver compiled, needs hardware validation
 *     - 'planned'   → Driver NOT compiled, will require firmware OTA
 *
 * Run after migration 018.
 */

/** @param {import('knex').Knex} knex */
exports.seed = async function (knex) {
  await knex('driver_catalog').del();

  const catalog = [
    // ────────────────────────────────────────────────��─────────────────────────
    // SENSORS — Temperature & Humidity
    // ──────────────────────────────────────────────────────────────────────────
    {
      model: 'DHT22', name: 'DHT22 Temperature & Humidity', category: 'sensor',
      firmware_status: 'available',
      description: 'Digital temperature and humidity sensor. Range: -40~80°C, 0-100% RH. Accuracy: ±0.5°C, ±2% RH. One-wire protocol.',
      datastreams: JSON.stringify([
        { key: 'temperature', name: 'Temperature', type: 'number', direction: 'input', unit: '°C' },
        { key: 'humidity', name: 'Humidity', type: 'number', direction: 'input', unit: '%' },
      ]),
      config_schema: JSON.stringify({ gpio: { type: 'number', default: 32, label: 'Data Pin' } }),
      icon: 'Thermometer', sort_order: 1,
    },
    {
      model: 'DHT11', name: 'DHT11 Temperature & Humidity (Basic)', category: 'sensor',
      firmware_status: 'planned',
      description: 'Basic temperature and humidity sensor. Range: 0~50°C, 20-80% RH. Accuracy: ±2°C, ±5% RH. One-wire protocol.',
      datastreams: JSON.stringify([
        { key: 'temperature', name: 'Temperature', type: 'number', direction: 'input', unit: '°C' },
        { key: 'humidity', name: 'Humidity', type: 'number', direction: 'input', unit: '%' },
      ]),
      config_schema: JSON.stringify({ gpio: { type: 'number', default: 14, label: 'Data Pin' } }),
      icon: 'Thermometer', sort_order: 2,
    },
    {
      model: 'BME280', name: 'BME280 Temperature, Humidity & Pressure', category: 'sensor',
      firmware_status: 'untested',
      description: 'Precision environmental sensor. Temperature, humidity, and barometric pressure via I2C. Accuracy: ±1°C, ±3% RH, ±1 hPa.',
      datastreams: JSON.stringify([
        { key: 'temperature', name: 'Temperature', type: 'number', direction: 'input', unit: '°C' },
        { key: 'humidity', name: 'Humidity', type: 'number', direction: 'input', unit: '%' },
        { key: 'pressure', name: 'Pressure', type: 'number', direction: 'input', unit: 'hPa' },
        { key: 'altitude', name: 'Altitude', type: 'number', direction: 'input', unit: 'm' },
      ]),
      config_schema: JSON.stringify({ i2c_addr: { type: 'string', default: '0x76', label: 'I2C Address' } }),
      icon: 'Gauge', sort_order: 3,
    },
    {
      model: 'DS18B20', name: 'DS18B20 1-Wire Temperature', category: 'sensor',
      firmware_status: 'untested',
      description: 'Waterproof digital temperature probe. Range: -55~125°C. Accuracy: ±0.5°C. 1-Wire (Dallas) protocol. Multiple sensors on single pin.',
      datastreams: JSON.stringify([
        { key: 'temperature', name: 'Temperature', type: 'number', direction: 'input', unit: '°C' },
      ]),
      config_schema: JSON.stringify({ gpio: { type: 'number', default: 14, label: 'Data Pin (1-Wire)' } }),
      icon: 'Thermometer', sort_order: 4,
    },

    // ──────────────────────────────────────────────────────────────────────────
    // SENSORS — Air Quality
    // ──────────────────────────────────────────────────────────────────────────
    {
      model: 'PIR', name: 'PIR HC-SR501 Motion Sensor', category: 'sensor',
      firmware_status: 'untested',
      description: 'Passive infrared motion detector. Range: 3-7m, 120° cone. Digital output (HIGH = motion). Adjustable delay and sensitivity.',
      datastreams: JSON.stringify([
        { key: 'motion', name: 'Motion Detected', type: 'boolean', direction: 'input' },
      ]),
      config_schema: JSON.stringify({ gpio: { type: 'number', default: 27, label: 'Signal Pin' } }),
      icon: 'Eye', sort_order: 10,
    },
    {
      model: 'HC-SR04', name: 'HC-SR04 Ultrasonic Distance', category: 'sensor',
      firmware_status: 'untested',
      description: 'Ultrasonic distance measurement. Range: 2cm-4m. Accuracy: ±3mm. Uses trigger + echo GPIO pins.',
      datastreams: JSON.stringify([
        { key: 'distance', name: 'Distance', type: 'number', direction: 'input', unit: 'cm' },
      ]),
      config_schema: JSON.stringify({
        trigger_gpio: { type: 'number', default: 26, label: 'Trigger Pin' },
        echo_gpio: { type: 'number', default: 27, label: 'Echo Pin' },
      }),
      icon: 'Ruler', sort_order: 11,
    },
    {
      model: 'CCS811', name: 'CCS811 CO₂ & TVOC Sensor', category: 'sensor',
      firmware_status: 'planned',
      description: 'Digital gas sensor for indoor air quality monitoring. Measures equivalent CO₂ (eCO₂) and Total Volatile Organic Compounds (TVOC) via I2C.',
      datastreams: JSON.stringify([
        { key: 'eco2', name: 'eCO₂', type: 'number', direction: 'input', unit: 'ppm' },
        { key: 'tvoc', name: 'TVOC', type: 'number', direction: 'input', unit: 'ppb' },
      ]),
      config_schema: JSON.stringify({ i2c_addr: { type: 'string', default: '0x5A', label: 'I2C Address' } }),
      icon: 'Wind', sort_order: 20,
    },
    {
      model: 'SGP30', name: 'SGP30 Air Quality (CO₂ + TVOC)', category: 'sensor',
      firmware_status: 'planned',
      description: 'MOX gas sensor. Measures equivalent CO₂ and TVOC. I2C interface. Auto-baseline correction.',
      datastreams: JSON.stringify([
        { key: 'eco2', name: 'eCO₂', type: 'number', direction: 'input', unit: 'ppm' },
        { key: 'tvoc', name: 'TVOC', type: 'number', direction: 'input', unit: 'ppb' },
      ]),
      config_schema: JSON.stringify({ i2c_addr: { type: 'string', default: '0x58', label: 'I2C Address' } }),
      icon: 'Wind', sort_order: 21,
    },
    {
      model: 'PMS5003', name: 'PMS5003 Particulate Matter Sensor', category: 'sensor',
      firmware_status: 'planned',
      description: 'Laser particle counter. Measures PM1.0, PM2.5, PM10. UART serial protocol. Industrial-grade air quality monitoring.',
      datastreams: JSON.stringify([
        { key: 'pm1_0', name: 'PM 1.0', type: 'number', direction: 'input', unit: 'µg/m³' },
        { key: 'pm2_5', name: 'PM 2.5', type: 'number', direction: 'input', unit: 'µg/m³' },
        { key: 'pm10', name: 'PM 10', type: 'number', direction: 'input', unit: 'µg/m³' },
      ]),
      icon: 'Cloud', sort_order: 22,
    },

    // ──────────────────────────────────────────────────────────────────────────
    // SENSORS — Light
    // ──────────────────────────────────────────────────────────────────────────
    {
      model: 'BH1750', name: 'BH1750 Ambient Light Sensor', category: 'sensor',
      firmware_status: 'planned',
      description: 'Digital ambient light intensity sensor. Range: 1-65535 lux. I2C interface. Ideal for automatic lighting control.',
      datastreams: JSON.stringify([
        { key: 'light', name: 'Light Intensity', type: 'number', direction: 'input', unit: 'lux' },
      ]),
      config_schema: JSON.stringify({ i2c_addr: { type: 'string', default: '0x23', label: 'I2C Address' } }),
      icon: 'Sun', sort_order: 30,
    },

    // ──────────────────────────────────────────────────────────────────────────
    // SENSORS — Agriculture
    // ──────────────────────────────────────────────────────────────────────────
    {
      model: 'SHT30', name: 'SHT30 Temperature & Humidity', category: 'sensor',
      firmware_status: 'planned',
      description: 'High-precision I2C temperature and humidity sensor. Accuracy: ±0.3°C, ±2% RH. Industrial grade. Protected membrane option available.',
      datastreams: JSON.stringify([
        { key: 'temperature', name: 'Temperature', type: 'number', direction: 'input', unit: '°C' },
        { key: 'humidity', name: 'Humidity', type: 'number', direction: 'input', unit: '%' },
      ]),
      config_schema: JSON.stringify({ i2c_addr: { type: 'string', default: '0x44', label: 'I2C Address' } }),
      icon: 'Thermometer', sort_order: 40,
    },

    // ──────────────────────────────────────────────────────────────────────────
    // SENSORS — Energy / Power
    // ──────────────────────────────────────────────────────────────────────────
    {
      model: 'INA219', name: 'INA219 Current & Voltage Sensor', category: 'sensor',
      firmware_status: 'planned',
      description: 'I2C bidirectional current/power monitor. Measures voltage (0-26V), current (±3.2A), and power. Ideal for solar/battery monitoring.',
      datastreams: JSON.stringify([
        { key: 'voltage', name: 'Voltage', type: 'number', direction: 'input', unit: 'V' },
        { key: 'current', name: 'Current', type: 'number', direction: 'input', unit: 'mA' },
        { key: 'power', name: 'Power', type: 'number', direction: 'input', unit: 'mW' },
      ]),
      config_schema: JSON.stringify({ i2c_addr: { type: 'string', default: '0x40', label: 'I2C Address' } }),
      icon: 'Zap', sort_order: 50,
    },

    // ──────────────────────────────────────────────────────────────────────────
    // ACTUATORS — Relays & Switching
    // ──────────────────────────────────────────────────────────────────────────
    {
      model: 'RELAY', name: 'Relay Controller (1-8 Channels)', category: 'actuator',
      firmware_status: 'available',
      description: 'Multi-channel relay module. Active LOW (0=ON, 1=OFF). Each channel independently controllable via MQTT. Supports latching and momentary modes.',
      datastreams: JSON.stringify(
        Array.from({ length: 8 }, (_, i) => ({
          key: `relay_${i + 1}`, name: `Relay ${i + 1}`, type: 'boolean', direction: 'output',
        })),
      ),
      config_schema: JSON.stringify({
        channels: {
          type: 'array',
          label: 'Relay Channels',
          items: {
            num: { type: 'number', label: 'Channel Number' },
            gpio: { type: 'number', label: 'GPIO Pin' },
            name: { type: 'string', label: 'Channel Name' },
          },
        },
      }),
      icon: 'ToggleLeft', sort_order: 100,
    },

    // ──────────────────────────────────────────────────────────────────────────
    // ACTUATORS — Motors & Servos
    // ──────────────────────────────────────────────────────────────────────────
    {
      model: 'SERVO', name: 'Servo Motor SG90 / MG996R', category: 'actuator',
      firmware_status: 'untested',
      description: 'PWM servo motor driver. Angle range: 0-180°. 50Hz PWM signal. SG90 (micro) or MG996R (standard) supported.',
      datastreams: JSON.stringify([
        { key: 'angle', name: 'Angle', type: 'number', direction: 'output', unit: '°', min: 0, max: 180 },
      ]),
      config_schema: JSON.stringify({ gpio: { type: 'number', default: 18, label: 'PWM Signal Pin' } }),
      icon: 'Move', sort_order: 110,
    },
    {
      model: 'STEPPER', name: 'Stepper Motor 28BYJ-48', category: 'actuator',
      firmware_status: 'planned',
      description: '5V unipolar stepper motor with ULN2003 driver. 2048 steps/revolution (4096 half-step). Ideal for valves, blinds, positioning.',
      datastreams: JSON.stringify([
        { key: 'position', name: 'Position', type: 'number', direction: 'output', unit: 'steps' },
        { key: 'speed', name: 'Speed', type: 'number', direction: 'output', unit: 'rpm' },
      ]),
      icon: 'Move3D', sort_order: 111,
    },

    // ──────────────────────────────────────────────────────────────────────────
    // ACTUATORS — Lighting
    // ──────────────────────────────────────────────────────────────────────────
    {
      model: 'WS2812B', name: 'WS2812B Addressable LED Strip', category: 'actuator',
      firmware_status: 'untested',
      description: 'Individually addressable RGB LED strip. Up to 256 LEDs per data pin. 24-bit color (16.7M colors). 5V power. RMT-driven for precise timing.',
      datastreams: JSON.stringify([
        { key: 'led_count', name: 'LED Count', type: 'number', direction: 'output' },
        { key: 'color', name: 'Color', type: 'string', direction: 'output' },
      ]),
      config_schema: JSON.stringify({
        gpio: { type: 'number', default: 25, label: 'Data Pin' },
        count: { type: 'number', default: 8, label: 'Number of LEDs' },
      }),
      icon: 'Palette', sort_order: 120,
    },
    {
      model: 'PWM', name: 'PWM Dimmer / Motor Speed', category: 'actuator',
      firmware_status: 'planned',
      description: 'Generic PWM output for LED dimming, fan speed control, or DC motor speed. 0-100% duty cycle. 16-bit resolution, configurable frequency.',
      datastreams: JSON.stringify([
        { key: 'duty', name: 'Duty Cycle', type: 'number', direction: 'output', unit: '%', min: 0, max: 100 },
      ]),
      config_schema: JSON.stringify({
        gpio: { type: 'number', default: 18, label: 'PWM Output Pin' },
        frequency: { type: 'number', default: 5000, label: 'PWM Frequency (Hz)' },
      }),
      icon: 'Sliders', sort_order: 121,
    },

    // ──────────────────────────────────────────────────────────────────────────
    // ACTUATORS — Fluid Control
    // ──────────────────────────────────────────────────────────────────────────
    {
      model: 'PUMP', name: 'Pump Controller', category: 'actuator',
      firmware_status: 'planned',
      description: 'Water/fluid pump control via relay. Supports timed operation with automatic shutoff. Ideal for irrigation, aquariums, hydroponics.',
      datastreams: JSON.stringify([
        { key: 'pump_state', name: 'Pump State', type: 'boolean', direction: 'output' },
        { key: 'pump_duration', name: 'Duration', type: 'number', direction: 'output', unit: 'seconds' },
      ]),
      icon: 'Droplets', sort_order: 130,
    },
    {
      model: 'VALVE', name: 'Solenoid Valve Controller', category: 'actuator',
      firmware_status: 'planned',
      description: 'Solenoid valve control for irrigation or gas systems. Normally closed (NC) or normally open (NO) valves supported.',
      datastreams: JSON.stringify([
        { key: 'valve_state', name: 'Valve State', type: 'boolean', direction: 'output' },
      ]),
      icon: 'Pipe', sort_order: 131,
    },

    // ──────────────────────────────────────────────────────────────────────────
    // ACTUATORS — Audio
    // ──────────────────────────────────────────────────────────────────────────
    {
      model: 'BUZZER', name: 'Piezo Buzzer', category: 'actuator',
      firmware_status: 'planned',
      description: 'Passive or active piezo buzzer. Supports tone generation (frequency + duration) and simple on/off. Ideal for alarms and notifications.',
      datastreams: JSON.stringify([
        { key: 'buzzer_state', name: 'Buzzer State', type: 'boolean', direction: 'output' },
        { key: 'frequency', name: 'Frequency', type: 'number', direction: 'output', unit: 'Hz' },
      ]),
      icon: 'Volume2', sort_order: 140,
    },

    // ──────────────────────────────────────────────────────────────────────────
    // DISPLAYS
    // ──────────────────────────────────────────────────────────────────────────
    {
      model: 'SSD1306', name: 'SSD1306 OLED Display 128x64', category: 'display',
      firmware_status: 'untested',
      description: 'Monochrome OLED display. 128x64 pixels. I2C interface (default 0x3C). 4 lines of text or custom graphics. Low power, high contrast.',
      datastreams: JSON.stringify([
        { key: 'text', name: 'Display Text', type: 'string', direction: 'output' },
        { key: 'clear', name: 'Clear Display', type: 'boolean', direction: 'output' },
      ]),
      config_schema: JSON.stringify({ i2c_addr: { type: 'string', default: '0x3C', label: 'I2C Address' } }),
      icon: 'Monitor', sort_order: 200,
    },
    {
      model: 'LCD1602_I2C', name: 'LCD 1602A I2C (16×2 Character)', category: 'display',
      firmware_status: 'untested',
      description: 'Character LCD display with I2C backpack (PCF8574). 16 columns × 2 rows. Blue backlight. Default I2C address 0x27. Common in Arduino/ESP32 projects.',
      datastreams: JSON.stringify([
        { key: 'text', name: 'Display Text', type: 'string', direction: 'output' },
        { key: 'clear', name: 'Clear Screen', type: 'boolean', direction: 'output' },
        { key: 'backlight', name: 'Backlight', type: 'boolean', direction: 'output' },
      ]),
      config_schema: JSON.stringify({ i2c_addr: { type: 'string', default: '0x27', label: 'I2C Address' } }),
      icon: 'Monitor', sort_order: 201,
    },
    {
      model: 'LCD1602_P', name: 'LCD 1602A Parallel (16×2, 16-pin)', category: 'display',
      firmware_status: 'planned',
      description: 'Character LCD display with parallel 4-bit interface. 16 columns × 2 rows. Requires 6 GPIO pins (RS, EN, D4-D7). For LCDs without I2C backpack.',
      datastreams: JSON.stringify([
        { key: 'text', name: 'Display Text', type: 'string', direction: 'output' },
        { key: 'clear', name: 'Clear Screen', type: 'boolean', direction: 'output' },
      ]),
      icon: 'Monitor', sort_order: 210,
    },
    {
      model: 'ST7735', name: 'ST7735 TFT Display 1.8"', category: 'display',
      firmware_status: 'planned',
      description: 'Color TFT LCD display. 128×160 pixels, 262K colors. SPI interface. Ideal for dashboards, gauges, and graphical output.',
      datastreams: JSON.stringify([
        { key: 'text', name: 'Display Content', type: 'string', direction: 'output' },
      ]),
      icon: 'Monitor', sort_order: 220,
    },
    {
      model: 'ST7789', name: 'ST7789 TFT Display 1.3-2.4"', category: 'display',
      firmware_status: 'planned',
      description: 'IPS color TFT display. 240×240 or 320×240 pixels. 65K colors. SPI interface. Wide viewing angle.',
      datastreams: JSON.stringify([
        { key: 'text', name: 'Display Content', type: 'string', direction: 'output' },
      ]),
      icon: 'Monitor', sort_order: 221,
    },
    {
      model: 'ILI9341', name: 'ILI9341 TFT Display 2.8"', category: 'display',
      firmware_status: 'planned',
      description: 'Large color TFT display. 320×240 pixels, 262K colors. SPI interface. Touch screen option available.',
      datastreams: JSON.stringify([
        { key: 'text', name: 'Display Content', type: 'string', direction: 'output' },
      ]),
      icon: 'Monitor', sort_order: 222,
    },

    // ──────────────────────────────────────────────────────────────────────────
    // INPUT DEVICES
    // ──────────────────────────────────────────────────────────────────────────
    {
      model: 'BUTTON', name: 'Push Button', category: 'sensor',
      firmware_status: 'planned',
      description: 'Momentary push button. Digital input with internal pull-up. Configurable as normally open (NO) or normally closed (NC).',
      datastreams: JSON.stringify([
        { key: 'button_state', name: 'Button Pressed', type: 'boolean', direction: 'input' },
      ]),
      icon: 'MousePointerClick', sort_order: 300,
    },
    {
      model: 'KEYPAD', name: 'Matrix Keypad (4×4)', category: 'sensor',
      firmware_status: 'planned',
      description: '4×4 matrix keypad (16 keys). 8 GPIO pins (4 rows, 4 columns). Ideal for security codes, menu navigation, numeric input.',
      datastreams: JSON.stringify([
        { key: 'key', name: 'Key Pressed', type: 'string', direction: 'input' },
      ]),
      icon: 'Keyboard', sort_order: 310,
    },
    {
      model: 'ENCODER', name: 'Rotary Encoder', category: 'sensor',
      firmware_status: 'planned',
      description: 'Rotary encoder with push button. 2 GPIO pins for rotation (A/B channels) + 1 for button. Ideal for volume, menu navigation, parameter adjustment.',
      datastreams: JSON.stringify([
        { key: 'position', name: 'Position', type: 'number', direction: 'input' },
        { key: 'button', name: 'Button', type: 'boolean', direction: 'input' },
      ]),
      icon: 'RotateCw', sort_order: 320,
    },
    {
      model: 'RFID-RC522', name: 'RFID RC522 Reader', category: 'sensor',
      firmware_status: 'planned',
      description: '13.56MHz RFID/NFC reader. Reads MIFARE and NTAG cards/tags. SPI interface. Ideal for access control and inventory tracking.',
      datastreams: JSON.stringify([
        { key: 'card_uid', name: 'Card UID', type: 'string', direction: 'input' },
        { key: 'card_present', name: 'Card Detected', type: 'boolean', direction: 'input' },
      ]),
      icon: 'CreditCard', sort_order: 330,
    },

    // ──────────────────────────────────────────────────────────────────────────
    // INDUSTRIAL
    // ────────────────────────────────────────────────��─────────────────────────
    {
      model: 'MODBUS', name: 'Modbus RTU (RS485)', category: 'sensor',
      firmware_status: 'planned',
      description: 'Industrial Modbus RTU protocol over RS485. Supports reading/writing coils, holding registers, input registers. Ideal for PLC and industrial sensor integration.',
      datastreams: JSON.stringify([
        { key: 'register_value', name: 'Register Value', type: 'number', direction: 'input' },
      ]),
      icon: 'Cable', sort_order: 400,
    },
    {
      model: 'RS485', name: 'RS485 Serial Communication', category: 'sensor',
      firmware_status: 'planned',
      description: 'Generic RS485 half-duplex communication. Custom protocol support. Long-distance (up to 1200m), multi-drop (up to 32 devices).',
      icon: 'Cable', sort_order: 410,
    },
  ];

  await knex('driver_catalog').insert(catalog);
};
