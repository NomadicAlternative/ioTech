const mqtt = require('mqtt');
const { createMqttConfig } = require('../config/mqtt');
const { handleHeartbeat } = require('./handlers/heartbeat');
const { getSocketService } = require('../socket/socketServer');

// Legacy topic for backward compatibility
const SUBSCRIBE_TOPIC_LEGACY = 'devices/+/telemetry';

// New tenant-namespaced topic for heartbeat / status
// Pattern: org/{tenantId}/device/{deviceId}/status
// OTA notify (future): org/{tenantId}/device/{deviceId}/ota/notify
const SUBSCRIBE_TOPIC_STATUS = 'org/+/device/+/status';
const SUBSCRIBE_TOPIC_TELEMETRY = 'org/+/device/+/telemetry';

let client = null;

/**
 * Initialize the MQTT client.
 *
 * @param {{ telemetryService?: { ingest: Function }, socketService?: { emitTelemetry: Function } }} [deps={}]
 *   Optional dependency injection. Pass `{ telemetryService, socketService }` from index.js
 *   so the MQTT bridge can persist telemetry and emit real-time events without circular requires.
 */
function initMqtt(deps) {
  const { telemetryService, socketService } = deps || {};
  const { url, options } = createMqttConfig();

  if (!url) {
    console.warn('MQTT_BROKER_URL is not set. Skipping MQTT connection.');
    return null;
  }

  client = mqtt.connect(url, options);

  client.on('connect', () => {
    console.log('MQTT connected to', url);
    // Subscribe to legacy telemetry topic
    client.subscribe(SUBSCRIBE_TOPIC_LEGACY, (err, granted) => {
      if (err) {
        console.error('Failed to subscribe to', SUBSCRIBE_TOPIC_LEGACY, err);
      } else {
        console.log('Subscribed to', SUBSCRIBE_TOPIC_LEGACY, 'granted=', granted);
      }
    });
    // Subscribe to new tenant-namespaced status (heartbeat) topic
    client.subscribe(SUBSCRIBE_TOPIC_STATUS, (err, granted) => {
      if (err) {
        console.error('Failed to subscribe to', SUBSCRIBE_TOPIC_STATUS, err);
      } else {
        console.log('Subscribed to', SUBSCRIBE_TOPIC_STATUS, 'granted=', granted);
      }
    });
    // Subscribe to new tenant-namespaced telemetry topic
    client.subscribe(SUBSCRIBE_TOPIC_TELEMETRY, (err, granted) => {
      if (err) {
        console.error('Failed to subscribe to', SUBSCRIBE_TOPIC_TELEMETRY, err);
      } else {
        console.log('Subscribed to', SUBSCRIBE_TOPIC_TELEMETRY, 'granted=', granted);
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

  /**
   * Extract tenantId and deviceId from new topic format:
   * org/{tenantId}/device/{deviceId}/{event}
   */
  function extractTenantDevice(topic) {
    const m = /^org\/([^/]+)\/device\/([^/]+)\/(.+)$/.exec(topic);
    if (!m) return null;
    return { tenantId: m[1], deviceId: m[2], event: m[3] };
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

      // ── Route to appropriate handler ─────────────────────────────────────
      // New namespaced topic: org/{tenantId}/device/{deviceId}/{event}
      const tenantDevice = extractTenantDevice(topic);
      if (tenantDevice) {
        if (tenantDevice.event === 'status') {
          // Accept plain string ("online") or JSON ({ status: "online" })
          const statusPayload = parsed.ok ? parsed.value : { status: payloadStr };
          handleHeartbeat(tenantDevice.tenantId, tenantDevice.deviceId, statusPayload).catch((err) => {
            console.error('[MQTT] heartbeat handler error:', err && err.message ? err.message : err);
          });
          // Emit real-time status update to dashboard via WebSocket
          const socketSvc = getSocketService();
          if (socketSvc) {
            const onlineStatus = statusPayload.status || payloadStr;
            socketSvc.emitDeviceStatus(tenantDevice.tenantId, tenantDevice.deviceId, onlineStatus);
          }
        } else if (tenantDevice.event === 'telemetry') {
          // Handle telemetry from org-scoped topic
          if (parsed.ok && telemetryService) {
            telemetryService.ingest(tenantDevice.tenantId, tenantDevice.deviceId, parsed.value).catch((err) => {
              console.error('[MQTT] telemetry ingest error:', err && err.message ? err.message : err);
            });
            const socketSvc = getSocketService();
            if (socketSvc) {
              socketSvc.emitTelemetry(tenantDevice.tenantId, tenantDevice.deviceId, parsed.value);
            }
          }
        }
        // Future: add more event handlers here (ota/notify, etc.)
        return;
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
          .then((row) => {
            // Emit real-time telemetry event after successful persistence
            if (socketService && row) {
              socketService.emitTelemetry(
                row.tenant_id,
                deviceId,
                data,
                row.received_at,
                row.id
              );
            }
          })
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
