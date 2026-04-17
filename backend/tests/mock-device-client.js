#!/usr/bin/env node
'use strict';

/**
 * Mock Device Client — Phase 4a Smoke Test
 *
 * Simulates an ESP32 device going through the full provisioning flow:
 * 1. POST /api/provisioning  → receive device_token + mqtt_url
 * 2. Connect to MQTT broker  → with username=deviceId, password=device_token
 * 3. Publish heartbeat       → to org/{tenantId}/device/{deviceId}/status
 *
 * Usage:
 *   node tests/mock-device-client.js \
 *     --api-url http://localhost:3000 \
 *     --claim-token <your-claim-token> \
 *     --hardware-id <hardware-id> \
 *     [--device-id <device-id>]
 *
 * NOT part of CI pipeline — run manually for E2E smoke testing.
 */

const https = require('https');
const http = require('http');

// ── Parse CLI args ────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    apiUrl: 'http://localhost:3000',
    claimToken: null,
    hardwareId: null,
    deviceId: null,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--api-url') opts.apiUrl = args[++i];
    else if (args[i] === '--claim-token') opts.claimToken = args[++i];
    else if (args[i] === '--hardware-id') opts.hardwareId = args[++i];
    else if (args[i] === '--device-id') opts.deviceId = args[++i];
  }
  return opts;
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const data = JSON.stringify(body);

    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode, body: raw });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── Main flow ─────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();

  if (!opts.claimToken || !opts.hardwareId) {
    console.error('Usage: node mock-device-client.js --claim-token <tok> --hardware-id <hw>');
    process.exit(1);
  }

  // Step 1: Provision
  console.log('\n[mock-device] Step 1: Provisioning...');
  const provRes = await postJson(`${opts.apiUrl}/api/provisioning`, {
    claim_token: opts.claimToken,
    hardware_id: opts.hardwareId,
  });

  if (provRes.status !== 200) {
    console.error('[mock-device] Provisioning failed:', provRes.status, provRes.body);
    process.exit(1);
  }

  const { device_token: deviceToken, mqtt_url: mqttUrl, tenant_id: tenantId, device_id: deviceId } = provRes.body;
  const resolvedDeviceId = opts.deviceId || deviceId;

  console.log('[mock-device] Provisioned successfully!');
  console.log('  device_id  :', resolvedDeviceId);
  console.log('  tenant_id  :', tenantId);
  console.log('  mqtt_url   :', mqttUrl);
  console.log('  device_token: [hidden]');

  // Step 2: Connect to MQTT
  let mqttModule;
  try {
    mqttModule = require('mqtt');
  } catch {
    console.warn('[mock-device] mqtt package not available — skipping MQTT step.');
    console.log('[mock-device] Smoke test complete (provisioning only).');
    return;
  }

  console.log('\n[mock-device] Step 2: Connecting to MQTT broker at', mqttUrl);

  const mqttClient = mqttModule.connect(mqttUrl, {
    clientId: resolvedDeviceId,
    username: resolvedDeviceId,
    password: deviceToken,
    clean: true,
    connectTimeout: 10_000,
  });

  mqttClient.on('connect', () => {
    console.log('[mock-device] MQTT connected!');

    // Step 3: Publish heartbeat
    const topic = `org/${tenantId}/device/${resolvedDeviceId}/status`;
    const payload = JSON.stringify({ status: 'online', ts: new Date().toISOString() });

    console.log(`\n[mock-device] Step 3: Publishing heartbeat to ${topic}`);
    mqttClient.publish(topic, payload, { qos: 0 }, (err) => {
      if (err) {
        console.error('[mock-device] Publish error:', err.message);
      } else {
        console.log('[mock-device] Heartbeat published!');
        console.log('  topic  :', topic);
        console.log('  payload:', payload);
      }

      setTimeout(() => {
        mqttClient.end();
        console.log('\n[mock-device] Smoke test complete ✓');
      }, 1000);
    });
  });

  mqttClient.on('error', (err) => {
    console.error('[mock-device] MQTT error:', err.message);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error('[mock-device] Fatal error:', err.message);
  process.exit(1);
});
