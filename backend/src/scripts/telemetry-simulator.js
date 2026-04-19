'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const mqtt = require('mqtt');

// ─── Config ───────────────────────────────────────────────────────────────────

const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const DEVICE_ID = 'dev-token-esp32-001';
const TOPIC = `devices/${DEVICE_ID}/telemetry`;
const INTERVAL_MS = 5000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomInRange(min, max) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

function buildPayload() {
  return {
    temperature: randomInRange(15, 30),
    humidity: randomInRange(40, 70),
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log(`[simulator] Connecting to ${BROKER_URL}…`);

const client = mqtt.connect(BROKER_URL);

client.on('connect', () => {
  console.log(`[simulator] Connected. Publishing to "${TOPIC}" every ${INTERVAL_MS / 1000}s`);

  const interval = setInterval(() => {
    const payload = buildPayload();
    const message = JSON.stringify(payload);

    client.publish(TOPIC, message, { qos: 0 }, (err) => {
      if (err) {
        console.error('[simulator] Publish error:', err.message);
      } else {
        console.log(`[simulator] Published → ${message}`);
      }
    });
  }, INTERVAL_MS);

  process.on('SIGINT', () => {
    console.log('\n[simulator] Shutting down…');
    clearInterval(interval);
    client.end(false, () => {
      console.log('[simulator] Disconnected. Bye!');
      process.exit(0);
    });
  });
});

client.on('error', (err) => {
  console.error('[simulator] MQTT error:', err.message);
  process.exit(1);
});
