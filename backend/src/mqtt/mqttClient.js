const mqtt = require('mqtt');
const { createMqttConfig } = require('../config/mqtt');

const SUBSCRIBE_TOPIC = 'devices/+/telemetry';

let client = null;

/**
 * Initialize the MQTT client.
 *
 * @param {{ telemetryService?: { ingest: Function } }} [deps={}]
 *   Optional dependency injection. Pass `{ telemetryService }` from index.js
 *   so the MQTT bridge can persist telemetry without a circular require.
 */
function initMqtt(deps) {
  const { telemetryService } = deps || {};
  const { url, options } = createMqttConfig();

  if (!url) {
    console.warn('MQTT_BROKER_URL is not set. Skipping MQTT connection.');
    return null;
  }

  client = mqtt.connect(url, options);

  client.on('connect', () => {
    console.log('MQTT connected to', url);
    client.subscribe(SUBSCRIBE_TOPIC, (err, granted) => {
      if (err) {
        console.error('Failed to subscribe to', SUBSCRIBE_TOPIC, err);
      } else {
        console.log('Subscribed to', SUBSCRIBE_TOPIC, 'granted=', granted);
      }
    });
  });

  // Modular handler: extrae deviceId, parsea JSON de forma segura y construye
  // un objeto estructurado { deviceId, data, receivedAt }
  function extractDeviceId(topic) {
    // Esperamos topics como: devices/<deviceId>/telemetry
    const m = /^devices\/([^/]+)\/telemetry$/.exec(topic);
    return m ? m[1] : null;
  }

  function safeJsonParse(str) {
    try {
      return { ok: true, value: JSON.parse(str) };
    } catch (err) {
      return { ok: false, error: err };
    }
  }

  client.on('message', (topic, message) => {
    try {
      const payloadStr = message ? message.toString() : '';
      const deviceId = extractDeviceId(topic);

      if (!deviceId) {
        console.warn('MQTT: received message on unexpected topic format:', topic);
      }

      const parsed = safeJsonParse(payloadStr);
      let data = null;

      if (parsed.ok) {
        data = parsed.value;
      } else {
        // Log error but don't throw — requirement 4
        console.error('MQTT: invalid JSON payload from topic', topic, 'payload=', payloadStr, 'error=', parsed.error && parsed.error.message ? parsed.error.message : parsed.error);
      }

      const structured = {
        deviceId: deviceId,
        data: data,
        receivedAt: new Date().toISOString()
      };

      // Log original and structured form for clarity
      console.log('[MQTT] received', topic, '->', payloadStr);
      console.log('[MQTT] parsed ->', JSON.stringify(structured));

      // Persist telemetry via injected service (if available and deviceId resolved)
      if (telemetryService && deviceId) {
        // tenantId is null here — telemetryService.ingest() resolves it from the device record
        telemetryService
          .ingest(null, deviceId, data, new Date(structured.receivedAt))
          .catch((err) => {
            console.error(
              '[MQTT] telemetry persist error for device',
              deviceId,
              err && err.message ? err.message : err
            );
          });
      }
    } catch (err) {
      // Catch-all to prevent any unexpected error from bubbling
      console.error('MQTT: error handling message:', err && err.message ? err.message : err);
    }
  });

  client.on('error', (err) => {
    console.error('MQTT client error:', err && err.message ? err.message : err);
  });

  client.on('reconnect', () => console.log('MQTT reconnecting...'));
  client.on('offline', () => console.log('MQTT offline'));
  client.on('close', () => console.log('MQTT connection closed'));

  // Optional debug: if MQTT_DEBUG=true, log outgoing packets (cmd names)
  if (process.env.MQTT_DEBUG === 'true') {
    client.on('packetsend', (packet) => {
      try {
        console.log('MQTT packet sent:', packet && packet.cmd ? packet.cmd : packet);
      } catch (e) {
        /* ignore */
      }
    });
  }

  return client;
}

function getClient() {
  return client;
}

module.exports = { initMqtt, getClient };
