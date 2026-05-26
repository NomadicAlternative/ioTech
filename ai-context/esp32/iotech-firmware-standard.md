# ioTech Firmware Standard

> **Purpose:** Defines the mandatory architecture every ioTech-compatible firmware MUST follow. Agents generating C++ code or config MUST adhere to this standard. This is the contract between the generated `user_app.cpp`, the framework (`main.c`), and the cloud backend.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    BOOT SEQUENCE                         │
│                                                          │
│  1. io_board_init()        ← board pin map              │
│  2. nvs_storage_init()     ← persistent config          │
│  3. wifi_manager_start()   ← connect to saved AP        │
│  4. mqtt_manager_start()   ← connect to ioTech broker   │
│  5. user_setup()           ← USER CODE: driver init     │
│  6. state_machine → NORMAL ← provisioning done          │
└──────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────┐
│                    MAIN LOOP (30s heartbeat)             │
│                                                          │
│  heartbeat_task():                                       │
│    1. user_loop()            ← USER CODE: read sensors  │
│    2. io_driver_collect_all()← collect telemetry        │
│    3. mqtt_publish()         ← send to cloud            │
│    4. delay(30s)             ← FreeRTOS vTaskDelay      │
└──────────────────────────────────────────────────────────┘
```

---

## Mandatory MQTT Topics

Every ioTech device MUST publish and subscribe to these exact topics:

| Direction | Topic | Payload | Frequency |
|---|---|---|---|
| **Publish** | `org/{tenant}/device/{id}/telemetry` | `{ "temperature": 23.5, "relay1": "on" }` | Every 30s (heartbeat) |
| **Publish** | `org/{tenant}/device/{id}/status` | `"online"` or `"offline"` | On connect / heartbeat timeout |
| **Subscribe** | `org/{tenant}/device/{id}/command` | `{ "relay": 1, "state": "on" }` | On-demand |

### Telemetry Payload Schema
```json
{
  "temperature": 23.5,       // number, °C
  "humidity": 65.2,           // number, %
  "pressure": 1013.2,         // number, hPa
  "relay1": "on",             // string, "on"|"off"
  "relay2": "off",
  "motion": true,             // boolean
  "distance": 150.5,          // number, cm
  "_timestamp": 1716589200    // number, Unix epoch
}
```

---

## Mandatory Behaviors

### 1. Non-Blocking Architecture

```cpp
// ❌ FORBIDDEN: blocking delay
void loop() {
    delay(5000);  // Blocks WiFi stack, MQTT, watchdog
}

// ✅ CORRECT: iotech delay via FreeRTOS
void loop() {
    // ... sensor reads and logic ...
    delay(2000);  // This calls vTaskDelay() — non-blocking
}
```

The `delay()` in `iotech.hpp` is aliased to `vTaskDelay()` — it yields to FreeRTOS.

### 2. MQTT Reconnect

Devices MUST handle broker disconnection:
- On disconnect → attempt reconnect every 5s (first 5 attempts), then every 30s.
- On reconnect → send `status: "online"` + full telemetry.
- The framework (`mqtt_manager.c`) handles this. User code does NOT need to.

### 3. WiFi Reconnect

Devices MUST reconnect to saved AP:
- On disconnect → scan and reconnect. Saved credentials in NVS.
- On failure → fall back to provisioning mode (captive portal or serial).
- Framework handles this. User code does NOT need to.

### 4. OTA Updates

Devices MUST support Over-The-Air updates:
- Partition table: `factory`, `ota_0`, `ota_1`, `ota_data`.
- HTTPS download from ioTech firmware endpoint.
- Rollback on failure (bootloader-level).
- Framework (`ota_manager.c`) handles this.

### 5. Watchdog

Devices MUST have a hardware watchdog:
- Configured via ESP-IDF task watchdog.
- If `user_loop()` takes > 10s, watchdog resets the device.
- User code must keep `loop()` fast (< 2s per iteration).

### 6. Device Registration (Provisioning)

Devices MUST register before sending telemetry:
1. Device boots → enters provisioning mode (no credentials).
2. Captive portal or serial provisioning — installer provides WiFi + claim_token.
3. Device calls `POST /api/devices/register` → receives `device_id` + `device_token`.
4. Device stores credentials in NVS → reboots → connects normally.

---

## User Code Contract (`user_app.cpp`)

The generated C++ code MUST follow this structure:

```cpp
#include <iotech.hpp>

// ── Driver declarations ──
DHT22 dht(32);
Relay bomba(23, "Bomba de riego");

// ── setup() — called ONCE after framework init ──
void setup() {
    dht.begin();
    bomba.begin();
}

// ── loop() — called every 30s in heartbeat task ──
void loop() {
    float temp = dht.readTemperature();
    float hum  = dht.readHumidity();

    if (temp >= 30.0) {
        bomba.on();
    } else {
        bomba.off();
    }
    // NO delay() needed — heartbeat task handles cadence
}
```

### Rules for user_app.cpp

1. **Use only iotech.hpp classes.** No `digitalWrite()`, no `pinMode()`, no raw GPIO.
2. **Keep `loop()` under 2 seconds.** No long-running operations.
3. **No `while(true)` in loop().** The framework calls loop() on a timer.
4. **Declare drivers at file scope** (before `setup()`).
5. **All driver init in `setup()`.** No init in `loop()`.
6. **`extern "C"` linkage** — provided by the framework. User doesn't need to add it.

---

## What User Code MUST NOT Do

| Forbidden | Reason |
|---|---|
| `delay(5000)` (blocking) | Blocks FreeRTOS scheduler |
| `while(true)` | Never returns, watchdog fires |
| `WiFi.begin()` | Conflicts with framework WiFi manager |
| `mqtt_client.publish()` | Conflicts with framework MQTT manager |
| `digitalWrite()` | Not available — use `Relay::on()/off()` |
| `pinMode()` | Not available — use driver constructors |
| Raw `gpio_set_level()` | Bypasses io_driver — use wrappers |
| `#include <Arduino.h>` | Not Arduino — use `#include <iotech.hpp>` |
| Hardcoded MQTT topics | Framework manages topics automatically |
| `Serial.println()` for debug | Use `ESP_LOGI()` from esp_log.h |
