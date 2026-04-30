# Development Guide

Guía de desarrollo para evitar problemas comunes que ya costaron tiempo real.

---

## Comandos esenciales

### Miniterm — SIEMPRE con estos flags

```bash
python3 -m serial.tools.miniterm --dtr 0 --rts 0 /dev/cu.usbserial-10 115200
```

**Por qué:** Sin `--dtr 0 --rts 0`, abrir miniterm activa DTR/RTS en el adaptador USB-Serial,
lo que dispara el pin EN del ESP32 y causa un hard reset. El ESP32 entra al loop de serial
provisioning de 30 segundos y no conecta a WiFi/MQTT hasta que expira ese timeout.
Esto hace que parezca que el dispositivo no responde cuando en realidad está esperando credenciales.

### Backend

```bash
cd backend && node src/index.js
```

Si falla con `EADDRINUSE: address already in use :::3000`:

```bash
pkill -f "node.*index.js" && sleep 1 && node src/index.js
```

### Provisioning (después de cada flash)

El flash **siempre borra el NVS**. Ejecutar inmediatamente después de flashear:

```bash
python3 -c "
import serial, json, time
payload = json.dumps({
  'wifi_ssid': 'CABLEWORLD 2.4-97723',
  'wifi_password': 'artemio1',
  'backend_url': 'http://192.168.18.58:3000',
  'mqtt_url': 'mqtt://192.168.18.58:1883',
  'device_token': '34ef7cf2071f9c310b9946cbd4cd2ee9456149e6dd4534ff7c7cab0b15557217',
  'tenant_id': '216bfcbf-e88f-4ea3-b46a-550db49af2ed',
  'device_id': '8bb9c9c7-19c9-4682-a9b7-8e217d388cd8'
}) + '\n'
s = serial.Serial('/dev/cu.usbserial-10', 115200, timeout=1)
print('Sending...')
for i in range(30):
    s.write(payload.encode())
    time.sleep(0.3)
    print(f'Sent {i+1}/30')
s.close()
print('Done')
"
```

### Firmware — compilar y flashear

```bash
cd firmware

# Compilar
~/.platformio/penv/bin/pio run -e esp32dev

# Flashear (cerrar miniterm primero)
~/.platformio/penv/bin/pio run -e esp32dev --target upload --upload-port /dev/cu.usbserial-10
```

Si el build falla con errores de directorio o linker:

```bash
rm -rf .pio/build && ~/.platformio/penv/bin/pio run -e esp32dev
```

---

## Contrato MQTT — Comandos de relé

El formato exacto que el firmware espera. Cualquier variación es rechazada silenciosamente.

**Topic:**
```
org/{tenant_id}/device/{device_id}/command
```

**Payload:**
```json
{
  "type": "relay",
  "relay": 1,
  "state": "on"
}
```

| Campo | Tipo | Valores válidos |
|-------|------|----------------|
| `type` | string | `"relay"` |
| `relay` | number | `1` – `7` |
| `state` | string | `"on"` o `"off"` — **NO boolean** |

**Mapeo GPIO:**

| Relé | GPIO |
|------|------|
| 1 | 23 |
| 2 | 22 |
| 3 | 21 |
| 4 | 19 |
| 5 | 18 |
| 6 | 5 |
| 7 | 17 |

Los relés son **active LOW** — el firmware maneja esto internamente.

**Probar desde terminal:**
```bash
mosquitto_pub -h 192.168.18.58 -p 1883 \
  -t "org/216bfcbf-e88f-4ea3-b46a-550db49af2ed/device/8bb9c9c7-19c9-4682-a9b7-8e217d388cd8/command" \
  -m '{"type":"relay","relay":1,"state":"on"}'
```

---

## Protocolo de debug — relés no responden

Seguir este orden. No saltear pasos.

### Paso 1 — Verificar hardware (30 segundos)
- ¿El LED de power del módulo de relés está encendido? Si no: revisar fuente de 5V
- ¿El GND del módulo y el GND del ESP32 están en común?
- ¿Moviste algún cable recientemente?

### Paso 2 — Verificar que el ESP32 está conectado al broker
Abrir miniterm y buscar:
```
I mqtt_manager: MQTT connected
I mqtt_manager: Subscribed to command topic: org/...
```
Si no aparece: el ESP32 no está en WiFi o no pudo conectar al broker.

### Paso 3 — Aislar si el problema es software o hardware
Enviar comando directo con mosquitto_pub (ver arriba) y observar el miniterm.

- Si aparece `Relay N → ON (GPIO XX)` pero el relé no hace click → **problema de hardware** (alimentación, cableado)
- Si no aparece nada en el miniterm → **problema de conectividad MQTT** (el ESP32 no recibe el mensaje)
- Si aparece `Command JSON missing fields` → **el formato del payload es incorrecto**

### Paso 4 — Verificar el flujo completo
```
UI → backend (POST /api/devices/:id/command)
  → backend publica MQTT { type, relay, state }
  → ESP32 recibe → relay_controller: Relay N → ON
  → relé hace click
```

Verificar cada eslabón por separado antes de asumir que el problema está en el siguiente.

---

## Contexto del dispositivo de desarrollo

| Campo | Valor |
|-------|-------|
| Dispositivo | Acceso-001 |
| Device ID | `8bb9c9c7-19c9-4682-a9b7-8e217d388cd8` |
| Tenant ID | `216bfcbf-e88f-4ea3-b46a-550db49af2ed` |
| Puerto serial | `/dev/cu.usbserial-10` |
| MAC | `80:f3:da:4b:6e:e0` |
| IP ESP32 | `192.168.18.65` |
| IP Mac (backend/broker) | `192.168.18.58` |
| MQTT broker | `mqtt://192.168.18.58:1883` |
| Backend | `http://192.168.18.58:3000` |

---

## Lecciones aprendidas

### miniterm resetea el ESP32
**Síntoma:** El ESP32 entra en loop de "Waiting 30000ms for serial provisioning" cada vez que abrís miniterm.  
**Causa:** DTR/RTS del adaptador USB-Serial disparan el pin EN del ESP32.  
**Fix:** Siempre usar `--dtr 0 --rts 0`.

### Flash borra NVS
**Síntoma:** El ESP32 arranca sin credenciales WiFi/MQTT después de flashear.  
**Causa:** El comando de upload borra toda la flash incluyendo la partición NVS.  
**Fix:** Ejecutar el script de provisioning inmediatamente después de cada flash.

### Mismatch de contrato MQTT
**Síntoma:** El backend logguea "Published command" pero el firmware no responde. El miniterm muestra `Command JSON missing fields`.  
**Causa:** El firmware espera `state` como string (`"on"`/`"off"`), no como boolean. Y requiere el campo `type: "relay"`.  
**Fix:** El backend siempre construye el payload como `{ type: "relay", relay, state }` — nunca pasa el body del request directo al broker.

### MQTT clean session
**Síntoma:** El ESP32 se desconecta del broker cada ~60 segundos y pierde los comandos publicados durante la reconexión.  
**Causa:** Sin `disable_clean_session: true`, cada reconexión es una sesión nueva y el broker descarta las suscripciones y mensajes encolados.  
**Fix:** El firmware usa `keepalive: 60` y `disable_clean_session: true`.
