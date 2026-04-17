'use strict';

/**
 * Unit tests for mqttClient.js
 *
 * Focus: after telemetryService.ingest() resolves, socketService.emitTelemetry()
 * is called with the correct arguments from the persisted row.
 *
 * Also verifies: emitTelemetry is NOT called when persistence fails.
 */

jest.mock('mqtt');
const mqtt = require('mqtt');

jest.mock('../../config/mqtt', () => ({
  createMqttConfig: () => ({ url: 'mqtt://localhost:1883', options: {} }),
}));

const { initMqtt } = require('../mqttClient');

function makeClient() {
  const handlers = {};
  return {
    connected: true,
    on: jest.fn((event, fn) => { handlers[event] = fn; }),
    subscribe: jest.fn(),
    _handlers: handlers,
    _trigger: function (event, ...args) { this._handlers[event] && this._handlers[event](...args); },
  };
}

describe('mqttClient — socketService integration', () => {
  let mockClient;
  let telemetryService;
  let socketService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = makeClient();
    mqtt.connect.mockReturnValue(mockClient);

    telemetryService = { ingest: jest.fn() };
    socketService = { emitTelemetry: jest.fn() };
  });

  it('calls socketService.emitTelemetry() with correct args after successful ingest', async () => {
    const row = {
      id: 'row-uuid-1',
      tenant_id: 't1',
      device_id: 'd1',
      data: { temp: 22 },
      received_at: new Date('2026-01-01T00:00:00Z'),
    };
    telemetryService.ingest.mockResolvedValue(row);

    initMqtt({ telemetryService, socketService });
    mockClient._trigger('connect');

    const message = Buffer.from(JSON.stringify({ temp: 22 }));
    mockClient._trigger('message', 'devices/d1/telemetry', message);

    // Wait for async ingest to resolve
    await new Promise(resolve => setImmediate(resolve));

    expect(socketService.emitTelemetry).toHaveBeenCalledWith(
      't1',
      'd1',
      { temp: 22 },
      row.received_at,
      'row-uuid-1'
    );
  });

  it('does NOT call socketService.emitTelemetry() when ingest fails', async () => {
    telemetryService.ingest.mockRejectedValue(new Error('DB error'));

    initMqtt({ telemetryService, socketService });
    mockClient._trigger('connect');

    const message = Buffer.from(JSON.stringify({ temp: 22 }));
    mockClient._trigger('message', 'devices/d1/telemetry', message);

    await new Promise(resolve => setImmediate(resolve));

    expect(socketService.emitTelemetry).not.toHaveBeenCalled();
  });

  it('does NOT call socketService.emitTelemetry() when socketService is not injected', async () => {
    const row = { id: 'r1', tenant_id: 't1', device_id: 'd1', data: {}, received_at: new Date() };
    telemetryService.ingest.mockResolvedValue(row);

    // No socketService injected — backward compat
    initMqtt({ telemetryService });
    mockClient._trigger('connect');

    const message = Buffer.from(JSON.stringify({}));
    mockClient._trigger('message', 'devices/d1/telemetry', message);

    await new Promise(resolve => setImmediate(resolve));

    // Should not throw — no socketService means skip emit silently
    expect(socketService.emitTelemetry).not.toHaveBeenCalled();
  });
});
