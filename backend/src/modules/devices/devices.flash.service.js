'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const FIRMWARE_DIR = path.resolve(__dirname, '../../../../firmware');
const PIO_BIN = path.join(require('os').homedir(), '.platformio/penv/bin/pio');

/**
 * Detect ESP32 serial port.
 * @returns {string|null} port path or null
 */
function detectPort() {
  try {
    const devDir = '/dev';
    const files = fs.readdirSync(devDir);
    const port = files.find(f => f.startsWith('cu.usbserial-'));
    return port ? `/dev/${port}` : null;
  } catch {
    return null;
  }
}

/**
 * Flash ESP32 firmware via PlatformIO.
 * Calls onEvent(line) for each output line and onDone() when finished.
 *
 * @param {object} callbacks
 * @param {function} callbacks.onProgress — receives { step, line }
 * @param {function} callbacks.onDone — receives { success, error? }
 * @returns {{ abort: function }} controller
 */
function flashFirmware({ onProgress, onDone }) {
  const port = detectPort();
  if (!port) {
    onDone({ success: false, error: 'ESP32 not detected. Connect it via USB and try again.' });
    return { abort: () => {} };
  }

  let aborted = false;
  let currentStep = 'build';

  onProgress({ step: 'build', line: `🔍 ESP32 detected on ${port}` });
  onProgress({ step: 'build', line: '🔧 Building firmware...' });

  const pio = spawn(PIO_BIN, ['run', '-e', 'esp32dev'], {
    cwd: FIRMWARE_DIR,
    env: { ...process.env, PATH: process.env.PATH },
  });

  pio.stdout.on('data', (data) => {
    if (aborted) return;
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      onProgress({ step: currentStep, line: line.trim() });
    }
  });

  pio.stderr.on('data', (data) => {
    if (aborted) return;
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      onProgress({ step: currentStep, line: `⚠ ${line.trim()}` });
    }
  });

  pio.on('close', (code) => {
    if (aborted) return;
    if (code !== 0) {
      onDone({ success: false, error: `Build failed with code ${code}` });
      return;
    }

    onProgress({ step: 'build', line: '✅ Build complete' });

    // ── Flash ─────────────────────────────────────────────────────
    currentStep = 'flash';
    onProgress({ step: 'flash', line: `⚡ Flashing to ${port}...` });

    const upload = spawn(PIO_BIN, ['run', '-e', 'esp32dev', '--target', 'upload', '--upload-port', port], {
      cwd: FIRMWARE_DIR,
      env: { ...process.env, PATH: process.env.PATH },
    });

    upload.stdout.on('data', (data) => {
      if (aborted) return;
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        onProgress({ step: 'flash', line: line.trim() });
      }
    });

    upload.stderr.on('data', (data) => {
      if (aborted) return;
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        onProgress({ step: 'flash', line: `⚠ ${line.trim()}` });
      }
    });

    upload.on('close', (uploadCode) => {
      if (aborted) return;
      if (uploadCode === 0) {
        onProgress({ step: 'flash', line: '✅ Flash complete!' });
        onProgress({ step: 'flash', line: '🔄 ESP32 is rebooting...' });
        onDone({ success: true });
      } else {
        onDone({ success: false, error: `Flash failed with code ${uploadCode}` });
      }
    });
  });

  return {
    abort: () => {
      aborted = true;
      pio.kill('SIGTERM');
    },
  };
}

module.exports = { flashFirmware, detectPort };
