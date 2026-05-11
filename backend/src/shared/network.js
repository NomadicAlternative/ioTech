'use strict';

const os = require('os');

/**
 * Detect the best local IPv4 address for provisioning devices.
 *
 * Priority:
 *   1. WiFi (en0) or Ethernet (enX) — the interface ESP32 devices can reach
 *   2. First non-internal IPv4 address
 *   3. Fallback to 'localhost'
 *
 * @returns {string} e.g. '192.168.18.70'
 */
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  const preferred = process.env.NETWORK_INTERFACE || null;

  // 1. Preferred interface (from env or common names)
  const candidates = [
    preferred,
    'en0',     // macOS WiFi
    'en1',     // macOS Ethernet / Thunderbolt
    'eth0',    // Linux Ethernet
    'wlan0',   // Linux WiFi
  ].filter(Boolean);

  for (const name of candidates) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address;
      }
    }
  }

  // 2. Fallback: any non-internal IPv4
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address;
      }
    }
  }

  // 3. Last resort
  return 'localhost';
}

module.exports = { getLocalIp };
