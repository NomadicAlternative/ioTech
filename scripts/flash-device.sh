#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════
# ioTech — Flash & Provision Device (one-shot)
# Uso: ./flash-device.sh <DEVICE_ID>
# Ej:  ./flash-device.sh 7cf6c273-5de6-47fd-b6bf-d660b85f242e
# ═══════════════════════════════════════════════════════════════════

DEVICE_ID="${1:-}"
FIRMWARE_DIR="/Users/diegogarcia/Desktop/IoTech/ioTech/firmware"
PIO="$HOME/.platformio/penv/bin/pio"
BACKEND_URL="http://localhost:3000"
FRONTEND_URL="http://localhost:5173"

if [ -z "$DEVICE_ID" ]; then
  echo "❌ Usage: ./flash-device.sh <DEVICE_ID>"
  echo ""
  echo "   Get device ID from: $FRONTEND_URL/app/devices"
  exit 1
fi

# ── 1. Detect serial port ──────────────────────────────────────────
echo "🔍 Buscando ESP32..."
PORT=$(ls /dev/cu.usbserial-* 2>/dev/null | head -1)
if [ -z "$PORT" ]; then
  echo "❌ No ESP32 detected. Conectalo vía USB."
  exit 1
fi
echo "   ✅ Puerto: $PORT"

# ── 2. Build firmware ──────────────────────────────────────────────
echo "🔧 Compilando firmware..."
cd "$FIRMWARE_DIR"
$PIO run -e esp32dev 2>&1 | tail -3

# ── 3. Flash ────────────────────────────────────────────────────────
echo "⚡ Flasheando ESP32 en $PORT ..."
$PIO run -e esp32dev --target upload --upload-port "$PORT" 2>&1 | tail -5

# ── 4. Fetch device credentials ─────────────────────────────────────
echo "🔑 Obteniendo credenciales del device $DEVICE_ID ..."
CREDS=$(curl -s "$BACKEND_URL/api/devices/$DEVICE_ID/provisioning-credentials" 2>/dev/null)

if echo "$CREDS" | grep -q "error"; then
  echo "❌ No se pudieron obtener las credenciales. ¿El backend está corriendo?"
  echo "   $CREDS"
  exit 1
fi

DEVICE_TOKEN=$(echo "$CREDS" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['device_token'])")
TENANT_ID=$(echo "$CREDS" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['tenant_id'])")
BACKEND_IP=$(echo "$CREDS" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['backend_url'])")
MQTT_URL=$(echo "$CREDS" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['mqtt_url'])")

echo ""
echo "   ✅ Firmware flasheado"
echo "   📡 Backend:  $BACKEND_IP"
echo "   📨 MQTT:     $MQTT_URL"
echo "   🔑 Token:    ${DEVICE_TOKEN:0:8}..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🟢 Abrí esta URL en Chrome para provisionar:"
echo ""
echo "     $FRONTEND_URL/app/provision?device=$DEVICE_ID"
echo ""
echo "  O usá el botón 'Provision via USB' en el dispositivo."
echo "  ⚠️  Apretá EN/RESET en el ESP32 antes de conectar."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
