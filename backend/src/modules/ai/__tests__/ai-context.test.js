'use strict';

/**
 * Tests for the dynamic prompt builder and context modules.
 */

describe('Board Context', () => {
  let boardContext;

  beforeEach(() => {
    jest.resetModules();
    boardContext = require('../../ai/context/board-context');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('lists all supported boards', () => {
    const boards = boardContext.listBoards();
    expect(boards.length).toBe(4);
    expect(boards.map((b) => b.id).sort()).toEqual([
      'ESP32_C3',
      'ESP32_CAM',
      'ESP32_DEVKIT',
      'ESP32_S3',
    ]);
  });

  test('getBoard returns ESP32_DEVKIT with correct DHT pin', () => {
    const board = boardContext.getBoard('ESP32_DEVKIT');
    expect(board).toBeDefined();
    expect(board.pins.dht).toBe(32);
    expect(board.pins.i2c_sda).toBe(21);
    expect(board.pins.i2c_scl).toBe(22);
  });

  test('getBoard returns ESP32_CAM with correct constraints', () => {
    const board = boardContext.getBoard('ESP32_CAM');
    expect(board).toBeDefined();
    expect(board.pins.ws2812b).toBe(0xff);
    expect(board.pins.servo).toBe(0xff);
    expect(board.pins.pir).toBe(0xff);
  });

  test('getBoard returns null for invalid board ID', () => {
    expect(boardContext.getBoard('INVALID')).toBeNull();
  });

  test('getRelayGpio returns correct GPIO for relay 1 on DevKit', () => {
    const board = boardContext.getBoard('ESP32_DEVKIT');
    expect(boardContext.getRelayGpio(board, 1)).toBe(23);
    expect(boardContext.getRelayGpio(board, 2)).toBe(22);
  });

  test('getRelayGpio returns null for unavailable relay', () => {
    const board = boardContext.getBoard('ESP32_CAM');
    expect(boardContext.getRelayGpio(board, 8)).toBeNull();
  });

  test('isCapabilityAvailable returns false for buzzer on C3', () => {
    const board = boardContext.getBoard('ESP32_C3');
    expect(boardContext.isCapabilityAvailable(board, 'buzzer')).toBe(false);
  });

  test('isCapabilityAvailable returns true for DHT on DevKit', () => {
    const board = boardContext.getBoard('ESP32_DEVKIT');
    expect(boardContext.isCapabilityAvailable(board, 'dht')).toBe(true);
  });

  test('default board is ESP32_DEVKIT', () => {
    expect(boardContext.getDefaultBoard().id).toBe('ESP32_DEVKIT');
  });
});

describe('Driver Catalog', () => {
  let driverCatalog;

  beforeEach(() => {
    jest.resetModules();
    driverCatalog = require('../../ai/context/driver-catalog');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('lists all drivers', () => {
    const all = driverCatalog.listDrivers();
    expect(all.length).toBeGreaterThanOrEqual(10);
    const models = all.map((d) => d.model);
    expect(models).toContain('DHT22');
    expect(models).toContain('BME280');
    expect(models).toContain('RELAY');
    expect(models).toContain('PIR');
    expect(models).toContain('HC-SR04');
    expect(models).toContain('WS2812B');
    expect(models).toContain('SERVO');
    expect(models).toContain('SSD1306');
    expect(models).toContain('LCD1602');
    expect(models).toContain('BUZZER');
  });

  test('filters by category', () => {
    const sensors = driverCatalog.listDrivers('sensor');
    const actuators = driverCatalog.listDrivers('actuator');
    const displays = driverCatalog.listDrivers('display');

    expect(sensors.every((d) => d.category === 'sensor')).toBe(true);
    expect(actuators.every((d) => d.category === 'actuator')).toBe(true);
    expect(displays.every((d) => d.category === 'display')).toBe(true);
  });

  test('getDriver is case-insensitive', () => {
    expect(driverCatalog.getDriver('dht22')).toBeDefined();
    expect(driverCatalog.getDriver('DHT22')).toBeDefined();
    expect(driverCatalog.getDriver('Dht22')).toBeDefined();
    expect(driverCatalog.getDriver('RELAY')).toBeDefined();
    expect(driverCatalog.getDriver('relay')).toBeDefined();
  });

  test('getDriver returns null for unknown driver', () => {
    expect(driverCatalog.getDriver('BH1750')).toBeNull(); // not yet implemented
  });

  test('DHT22 has both temperature and humidity datastreams', () => {
    const dht22 = driverCatalog.getDriver('DHT22');
    expect(dht22.datastreams.length).toBe(2);
    expect(dht22.datastreams.map((d) => d.key).sort()).toEqual(['humidity', 'temperature']);
  });

  test('DHT22 is compatible with ESP32_DEVKIT', () => {
    expect(
      driverCatalog.isCompatibleWithBoard(driverCatalog.getDriver('DHT22'), 'ESP32_DEVKIT')
    ).toBe(true);
  });

  test('DS18B20 is NOT compatible with ESP32_CAM', () => {
    expect(
      driverCatalog.isCompatibleWithBoard(driverCatalog.getDriver('DS18B20'), 'ESP32_CAM')
    ).toBe(false);
  });

  test('DS18B20 is NOT compatible with ESP32_C3', () => {
    expect(
      driverCatalog.isCompatibleWithBoard(driverCatalog.getDriver('DS18B20'), 'ESP32_C3')
    ).toBe(false);
  });

  test('BUZZER is NOT compatible with ESP32_CAM', () => {
    expect(
      driverCatalog.isCompatibleWithBoard(driverCatalog.getDriver('BUZZER'), 'ESP32_CAM')
    ).toBe(false);
  });

  test('generateRelayDatastreams generates correct entries', () => {
    const streams = driverCatalog.generateRelayDatastreams(3);
    expect(streams.length).toBe(3);
    expect(streams[0].key).toBe('relay1');
    expect(streams[1].key).toBe('relay2');
    expect(streams[2].key).toBe('relay3');
    expect(streams[0].direction).toBe('output');
    expect(streams[0].type).toBe('string');
  });

  test('DH22 has bilingual descriptions', () => {
    const dht22 = driverCatalog.getDriver('DHT22');
    expect(dht22.description.es).toBeDefined();
    expect(dht22.description.en).toBeDefined();
    expect(dht22.notes.es).toBeDefined();
    expect(dht22.notes.en).toBeDefined();
  });
});

describe('Prompt Builder', () => {
  let promptBuilder;

  beforeEach(() => {
    jest.resetModules();
    promptBuilder = require('../../ai/context/prompt-builder');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('detects Spanish language', () => {
    expect(promptBuilder.detectLanguage('Tengo un ESP32 con DHT22')).toBe('es');
    expect(promptBuilder.detectLanguage('Quiero medir temperatura y humedad')).toBe('es');
    expect(promptBuilder.detectLanguage('Necesito conectar un relay')).toBe('es');
    expect(promptBuilder.detectLanguage('Configurar un sensor de presión y temperatura')).toBe(
      'es'
    );
  });

  test('detects English language', () => {
    expect(promptBuilder.detectLanguage('I have an ESP32 with DHT22')).toBe('en');
    expect(promptBuilder.detectLanguage('Measure temperature and control a relay')).toBe('en');
    expect(promptBuilder.detectLanguage('Configure a sensor')).toBe('en');
    expect(promptBuilder.detectLanguage('I need to monitor pressure and humidity')).toBe('en');
  });

  test('Spanish with accented characters is detected', () => {
    expect(promptBuilder.detectLanguage('Control de presión atmosférica')).toBe('es');
    expect(promptBuilder.detectLanguage('Medición de temperatura')).toBe('es');
  });

  test('defaults to English for ambiguous input', () => {
    expect(promptBuilder.detectLanguage('ESP32 DHT22 relay 1')).toBe('en');
    expect(promptBuilder.detectLanguage('temperature humidity sensor')).toBe('en');
  });

  test('buildSystemPrompt generates Spanish prompt for Spanish input', () => {
    const prompt = promptBuilder.buildSystemPrompt({
      userPrompt: 'Tengo un ESP32 con DHT22 y quiero controlar un relay',
      maxExamples: 1,
    });
    expect(typeof prompt).toBe('string');
    expect(prompt).toContain('Eres un asistente');
    expect(prompt).toContain('Placa seleccionada');
    expect(prompt).toContain('GPIO32');
    expect(prompt).toContain('DHT22');
    expect(prompt).toContain('RELAY');
    expect(prompt).toContain('Formato de respuesta OBLIGATORIO');
    expect(prompt).toContain('IMPORTANTE: El instalador habla en español');
  });

  test('buildSystemPrompt generates English prompt for English input', () => {
    const prompt = promptBuilder.buildSystemPrompt({
      userPrompt: 'I have an ESP32 with DHT22 and want to control a relay',
      maxExamples: 1,
    });
    expect(typeof prompt).toBe('string');
    expect(prompt).toContain('You are a configuration assistant');
    expect(prompt).toContain('Selected Board');
    expect(prompt).toContain('GPIO32');
    expect(prompt).toContain('DHT22');
    expect(prompt).toContain('REQUIRED Response Format');
    expect(prompt).toContain('IMPORTANT: The installer speaks English');
  });

  test('buildSystemPrompt includes board constraints', () => {
    const prompt = promptBuilder.buildSystemPrompt({
      userPrompt: 'I have an ESP32 with DHT22',
      boardId: 'ESP32_CAM',
    });
    expect(prompt).toContain('ESP32-CAM');
    expect(prompt).toContain('NOT AVAILABLE');
    expect(prompt).toContain('SD card');
  });

  test('buildSystemPrompt includes few-shot examples', () => {
    const prompt = promptBuilder.buildSystemPrompt({
      userPrompt: 'Tengo un ESP32 con DHT22',
      maxExamples: 2,
    });
    expect(prompt).toContain('Ejemplos de configuraciones');
    expect(prompt).toContain('"template"');
    expect(prompt).toContain('"drivers"');
  });

  test('buildUserPrompt wraps input correctly for Spanish', () => {
    const prompt = promptBuilder.buildUserPrompt('Quiero un sensor de temperatura', 'es');
    expect(prompt).toContain('Instalador dice');
    expect(prompt).toContain('Quiero un sensor de temperatura');
    expect(prompt).toContain('Generá la configuración JSON');
  });

  test('buildUserPrompt wraps input correctly for English', () => {
    const prompt = promptBuilder.buildUserPrompt('I want a temperature sensor', 'en');
    expect(prompt).toContain('Installer says');
    expect(prompt).toContain('I want a temperature sensor');
    expect(prompt).toContain('Generate the JSON configuration');
  });
});

describe('Examples', () => {
  let examples;

  beforeEach(() => {
    jest.resetModules();
    examples = require('../../ai/context/examples');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('has at least 3 examples', () => {
    expect(examples.getExampleCount()).toBeGreaterThanOrEqual(3);
  });

  test('can filter examples by board', () => {
    const esp32Examples = examples.getExamples({ board: 'ESP32_DEVKIT' });
    expect(esp32Examples.length).toBeGreaterThanOrEqual(2);
    esp32Examples.forEach((ex) => expect(ex.board).toBe('ESP32_DEVKIT'));
  });

  test('can filter examples by tag', () => {
    const dhtExamples = examples.getExamples({ tag: 'DHT22' });
    expect(dhtExamples.length).toBeGreaterThanOrEqual(1);
    dhtExamples.forEach((ex) => expect(ex.tags).toContain('DHT22'));
  });

  test('all examples have both Spanish and English user prompts', () => {
    const all = examples.getExamples();
    all.forEach((ex) => {
      expect(ex.user.es).toBeDefined();
      expect(ex.user.en).toBeDefined();
      expect(ex.config.template).toBeDefined();
      expect(ex.config.drivers).toBeDefined();
      expect(ex.config.datastreams).toBeDefined();
    });
  });
});
