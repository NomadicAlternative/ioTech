# SDD Design: C++ Code Editor with Bidirectional AI Sync

**Change ID:** `cpp-code-editor`
**Phase:** Design
**Date:** 2026-05-23

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  AIChat.tsx (tabbed layout)                                  │    │
│  │  ┌──────────────┐  ┌──────────────────────────────────────┐ │    │
│  │  │  Chat Tab    │  │  Code Tab                            │ │    │
│  │  │  (existing)  │  │  ┌──────────────┬──────────────────┐ │ │    │
│  │  │              │  │  │ CppEditor    │ DiagnosticsPanel │ │ │    │
│  │  │  prompt →    │  │  │ (Monaco)     │ (live regex)     │ │ │    │
│  │  │  configure → │  │  │              │ drivers/pins/    │ │ │    │
│  │  │  result      │  │  │ Code + diffs │ conflicts/rules  │ │ │    │
│  │  └──────┬───────┘  │  └──────┬───────┴────────┬─────────┘ │    │
│  │         │          │         │                │           │    │
│  │         │          │  [Sync] [Chat Edit]     [Live]       │    │
│  └─────────┼──────────┴─────────┼────────────────┼───────────┘    │
│            │                    │                │                 │
└────────────┼────────────────────┼────────────────┼─────────────────┘
             │ axios              │ axios           │ pure client-side
             ▼                    ▼                 
┌──────────────────────────────────────────────────────────────────────┐
│                           BACKEND                                    │
│                                                                      │
│  ai.routes.js                                                        │
│  ├─ POST /configure  (modified: +code field)                        │
│  ├─ POST /apply       (unchanged)                                    │
│  ├─ POST /sync        (NEW: C++ → JSON)                             │
│  └─ GET  /catalog     (unchanged)                                    │
│                                                                      │
│  ai.service.js                                                       │
│  ├─ configure()       → calls callLLM(), returns +code               │
│  ├─ apply()           (unchanged)                                    │
│  └─ syncFromCpp()     → LLM parser or regex fallback                 │
│                                                                      │
│  prompt-builder.js                                                   │
│  ├─ TEXTS.cppSdk      (NEW: C++ API documentation)                   │
│  ├─ TEXTS.outputFormat (extended: +"code" field)                     │
│  └─ buildSystemPrompt() → includes cppSdk, extended format           │
│                                                                      │
│  examples.js         → all 5 examples extended with `code` field     │
│  ai.schemas.js       → config schema + optional code: Joi.string()   │
└──────────────────────────────────────────────────────────────────────┘
             │ io_driver C vtable (extern "C")
             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                           FIRMWARE                                   │
│                                                                      │
│  include/iotech.hpp   (NEW)                                          │
│  ├─ class DHT22      → io_driver_load("DHT22") + read() vtable     │
│  ├─ class Relay      → io_driver_load("RELAY") + command() vtable  │
│  ├─ class BME280     → io_driver_load("BME280") + read() vtable    │
│  ├─ class PIR        → io_driver_load("PIR") + read() vtable       │
│  ├─ class HC_SR04    → io_driver_load("HC-SR04") + read() vtable   │
│  ├─ class Buzzer     → io_driver_load("BUZZER") + command() vtable │
│  ├─ class SSD1306    → io_driver_load("SSD1306") + command() vtable│
│  ├─ class LCD1602    → io_driver_load("LCD1602") + command() vtable│
│  ├─ class WS2812B    → io_driver_load("WS2812B") + command() vtable│
│  ├─ class SERVO      → io_driver_load("SERVO") + command() vtable  │
│  ├─ class DS18B20    → io_driver_load("DS18B20") + read() vtable   │
│  └─ void delay(ms)   → vTaskDelay wrapper                           │
│                                                                      │
│  src/user_app.cpp     (NEW) — user-editable logic                   │
│  src/main.c           (MODIFIED) — calls extern user_setup/loop     │
└──────────────────────────────────────────────────────────────────────┘
```

### Data Flow: Code Generation (Natural Language → C++)

```
User prompt
  │
  ▼
AIChat.tsx → POST /api/ai/configure { prompt, boardId }
  │
  ▼
ai.service.js → callLLM(prompt, boardId)
  │
  ▼
prompt-builder.js → buildSystemPrompt({ userPrompt, boardId })
  │  assembles:
  │  - role + task (unchanged)
  │  - boardContext (unchanged)
  │  - driverContext (unchanged)
  │  - cppSdk (NEW — documents iotech.hpp API)
  │  - rulesSection (unchanged)
  │  - outputFormat (EXTENDED — JSON + "code" field)
  │  - examples (EXTENDED — includes C++ code)
  │  - languageInstruction (unchanged)
  │
  ▼
DeepSeek API → JSON { template, drivers, datastreams, rules, diagrama, code }
  │
  ▼
ai.service.js → validateAiConfig() → return + _source: "ai"
  │
  ▼
AIChat.tsx → displays result in Chat tab
  │  user switches to Code tab → Monaco shows `result.code`
```

### Data Flow: Bidirectional Sync (C++ → JSON)

```
User edits code in Monaco
  │  (or user sends chat instruction → diff applied)
  │
  ▼
User clicks "Sync"
  │
  ▼
CppEditor.tsx → POST /api/ai/sync { code, boardId }
  │
  ▼
ai.service.js → syncFromCpp(code, boardId)
  │
  ├─ LLM path (DeepSeek available):
  │  buildSyncSystemPrompt(code, boardId) → DeepSeek → JSON config
  │
  └─ Fallback path (DeepSeek unavailable):
     regexParseCpp(code, boardId) → JSON config + diagnostics
  │
  ▼
validateAiConfig(config) → sanitized output
  │
  ▼
Response: { config, diagnostics: { drivers, conflicts, rules } }
  │
  ▼
CppEditor.tsx → updates syncedConfig state
DiagnosticsPanel → updates from response.diagnostics (LLM path)
  or from local regex (fallback path — already displayed live)
```

### Data Flow: Apply to Database

```
User clicks "Apply"
  │  (always parses current Monaco code → syncs if dirty)
  ▼
CppEditor.tsx → if code changed since last sync → POST /sync first
  │
  ▼
POST /api/ai/apply { config }  (unchanged flow)
  │
  ▼
ai.service.js → apply(tenantId, config)
  ├─ templatesService.create()  → device template + datastreams
  ├─ devicesService.create()    → device + claim_token
  └─ rulesService.create()      → automation rules
  │
  ▼
{ template, device, rules, claim_token, hardware_model }
```

---

## 2. Firmware Design

### 2.1 iotech.hpp — C++ Wrapper Layer

**Design decision: Header-only, no `.cpp` files for wrappers.**

Rationale: The wrappers are thin adapters over `extern "C"` vtable calls. Each method is ~3-5 lines. Putting them in a `.cpp` would require a separate compilation unit per wrapper class, adding build complexity with zero benefit. Header-only also means the user can include `iotech.hpp` and nothing else.

**Design decision: Each class holds minimal state, delegates to io_driver by name.**

Rationale: The wrapper classes don't own GPIOs or driver instances. They are namespaced handles that call `io_driver_load()`, `io_driver_read()`, and `io_driver_command()` by driver name string. This keeps the wrapper surface minimal and ensures all driver lifecycle is managed by the io_driver engine.

**Critical: How a wrapper class finds its values in the read() output.**

`io_driver_read()` returns `driver_value_t values[DRV_MAX_VALUES]` — key-value pairs. The wrapper class must search for its datastream key. Example: `DHT22::readTemperature()` calls `io_driver_collect_all()` (which iterates all drivers and collects values), or it would need a finer-grained API. However, `io_driver_collect_all()` returns `cJSON*` which is expensive to parse per-read.

**Design decision: Add `io_driver_read_by_name()` to the C API.**

Rationale: The current `io_driver_collect_all()` returns a full cJSON object — too heavy for per-sensor access. A lightweight function that reads a single driver by name and returns its value array is needed for the C++ wrappers. This is a small addition to `io_driver.c`.

```c
// NEW function in io_driver.h:
/**
 * Read values from a single active driver by name.
 * Populates values[DRV_MAX_VALUES] and *count (0..DRV_MAX_VALUES).
 * Returns DRV_ERR_NOT_FOUND if driver not active, or driver->read() error.
 */
drv_err_t io_driver_read_by_name(const char *name, driver_value_t *values, uint8_t *count);
```

**Design decision: Command dispatch uses the existing `io_driver_dispatch_command()` with cJSON.**

Rationale: `Relay::on()` needs to send `{ relay: 1, state: "on" }` via `io_driver_command()`. The existing dispatch takes `const void *arg` which is cast to `cJSON*` in the relay driver. The wrapper constructs a cJSON object inline and calls dispatch. On the ESP32, cJSON is already linked into the firmware (used by MQTT telemetry and provisioning).

#### 2.1.1 DHT22 Wrapper

```cpp
class DHT22 {
    uint8_t _pin;
    bool    _ready = false;

    // Scan read values for a key, return its number_value or NaN
    static float findValue(const driver_value_t *values, uint8_t count, const char *key) {
        for (uint8_t i = 0; i < count; i++) {
            if (strcmp(values[i].key, key) == 0) return (float)values[i].number_value;
        }
        return NAN;  // sentinel: key not found or driver not active
    }

public:
    explicit DHT22(uint8_t pin) : _pin(pin) {}

    drv_err_t begin() {
        driver_config_t cfg = {};
        cfg.gpio = _pin;
        drv_err_t err = io_driver_load("DHT22", &cfg);
        if (err == DRV_OK) _ready = true;
        return err;
    }

    float readTemperature() {
        if (!_ready) return NAN;
        driver_value_t values[DRV_MAX_VALUES];
        uint8_t count = 0;
        if (io_driver_read_by_name("DHT22", values, &count) != DRV_OK) return NAN;
        return findValue(values, count, "temperature");
    }

    float readHumidity() {
        if (!_ready) return NAN;
        driver_value_t values[DRV_MAX_VALUES];
        uint8_t count = 0;
        if (io_driver_read_by_name("DHT22", values, &count) != DRV_OK) return NAN;
        return findValue(values, count, "humidity");
    }
};
```

**Error handling:** All read methods return `NAN` (IEEE 754 NaN, available in `<cmath>` or as `__builtin_nan("")`). ESP32 GCC supports this. The user compares with `isnan()` or checks `dht.readTemperature() != dht.readTemperature()` (NaN is never equal to itself).

#### 2.1.2 Relay Wrapper

```cpp
class Relay {
    uint8_t     _pin;
    const char *_name;
    char        _activeName[32];
    bool        _state = false;
    bool        _ready = false;

public:
    Relay(uint8_t pin, const char *name) : _pin(pin), _name(name) {}

    drv_err_t begin() {
        driver_config_t cfg = {};
        cfg.gpio     = _pin;
        cfg.channels = 1;
        drv_err_t err = io_driver_load("RELAY", &cfg);
        if (err == DRV_OK) {
            // io_driver_load stores the disambiguated key (e.g. "RELAY_1")
            // in the active entry. Construct it ourselves for dispatch.
            snprintf(_activeName, sizeof(_activeName), "RELAY_%d", _pin);
            _ready = true;
        }
        return err;
    }

    void on() {
        if (!_ready) return;
        cJSON *cmd = cJSON_CreateObject();
        cJSON_AddNumberToObject(cmd, "relay", 1);
        cJSON_AddStringToObject(cmd, "state", "on");
        io_driver_dispatch_command(_activeName, cmd);
        cJSON_Delete(cmd);
        _state = true;
    }

    void off() {
        if (!_ready) return;
        cJSON *cmd = cJSON_CreateObject();
        cJSON_AddNumberToObject(cmd, "relay", 1);
        cJSON_AddStringToObject(cmd, "state", "off");
        io_driver_dispatch_command(_activeName, cmd);
        cJSON_Delete(cmd);
        _state = false;
    }

    bool state() const { return _state; }
};
```

**Design decision: Each Relay instance loads its own independent RELAY driver via io_driver_load, identical to how DHT22 or BME280 work. No shared state, no channel counting.**

This requires one change to `io_driver.c`: allow multiple loads of the same driver name when the driver declares `DRV_FLAG_MULTI_INSTANCE` (see §2.1.5 io_driver engine changes below). Each load creates a disambiguated active entry keyed by GPIO — e.g. `RELAY_23` for GPIO 23. The wrapper dispatches commands to its own instance via the disambiguated key.

Rationale: the user writes `Relay bomba(23, "Bomba")` and `Relay ventilador(22, "Ventilador")` as independent objects. Internally they are independent driver instances. The C++ API has zero special cases — every class follows the same pattern: constructor takes config → `begin()` calls `io_driver_load()` → methods dispatch to that instance.

#### 2.1.3 BME280 Wrapper

```cpp
class BME280 {
    uint8_t _addr;
    bool    _ready = false;

    static float findValue(const driver_value_t *values, uint8_t count, const char *key) {
        for (uint8_t i = 0; i < count; i++) {
            if (strcmp(values[i].key, key) == 0) return (float)values[i].number_value;
        }
        return NAN;
    }

public:
    explicit BME280(uint8_t addr = 0x76) : _addr(addr) {}

    drv_err_t begin() {
        driver_config_t cfg = {};
        cfg.i2c_addr = _addr;
        cfg.i2c_sda  = IO_BOARD_I2C_SDA;  // from io_board.h — compile-time constant
        cfg.i2c_scl  = IO_BOARD_I2C_SCL;
        drv_err_t err = io_driver_load("BME280", &cfg);
        if (err == DRV_OK) _ready = true;
        return err;
    }

    float readTemperature() {
        if (!_ready) return NAN;
        driver_value_t values[DRV_MAX_VALUES];
        uint8_t count = 0;
        if (io_driver_read_by_name("BME280", values, &count) != DRV_OK) return NAN;
        return findValue(values, count, "temperature");
    }

    float readHumidity() {
        if (!_ready) return NAN;
        driver_value_t values[DRV_MAX_VALUES];
        uint8_t count = 0;
        if (io_driver_read_by_name("BME280", values, &count) != DRV_OK) return NAN;
        return findValue(values, count, "humidity");
    }

    float readPressure() {
        if (!_ready) return NAN;
        driver_value_t values[DRV_MAX_VALUES];
        uint8_t count = 0;
        if (io_driver_read_by_name("BME280", values, &count) != DRV_OK) return NAN;
        return findValue(values, count, "pressure");
    }
};
```

#### 2.1.4 Remaining Wrappers (PIR, HC_SR04, Buzzer, Displays, WS2812B, SERVO, DS18B20)

Following the same pattern — all 11 classes follow this contract:

| Class | Constructor | begin() loads | readXxx() / command methods |
|---|---|---|---|
| `PIR` | `PIR(uint8_t pin)` | `"PIR"` via gpio | `bool motionDetected()` — reads "motion" key, returns bool_value |
| `HC_SR04` | `HC_SR04(uint8_t trig, uint8_t echo)` | `"HC-SR04"` via gpio+gpio2 | `float readDistance()` — reads "distance" key |
| `Buzzer` | `Buzzer(uint8_t pin)` | `"BUZZER"` via gpio | `void beep(uint16_t freq, uint16_t ms)` — dispatch `{action:"buzzer_tone", frequency, duration_ms}` |
| `SSD1306` | `SSD1306(uint8_t addr = 0x3C)` | `"SSD1306"` via i2c | `void print(const char* text, uint8_t line)`, `void clear()` |
| `LCD1602` | `LCD1602(uint8_t addr = 0x27)` | `"LCD1602"` via i2c | `void print(const char* text, uint8_t line)`, `void clear()`, `void setBacklight(bool on)` |
| `WS2812B` | `WS2812B(uint8_t pin, uint16_t numLeds)` | `"WS2812B"` via gpio+channels | `void fill(uint8_t r, uint8_t g, uint8_t b)`, `void set(uint16_t i, uint8_t r, uint8_t g, uint8_t b)` |
| `SERVO` | `Servo(uint8_t pin)` | `"SERVO"` via gpio | `void setAngle(uint8_t degrees)` — dispatch `{angle}` via cJSON |
| `DS18B20` | `DS18B20(uint8_t pin)` | `"DS18B20"` via gpio | `float readTemperature()` |

**Global utility:**

```cpp
void delay(unsigned long ms) {
    vTaskDelay(pdMS_TO_TICKS(ms));
}
```

**Header file structure:**

```cpp
// iotech.hpp
#pragma once

extern "C" {
#include "io_driver_types.h"
#include "io_driver.h"
#include "io_board.h"
#include "cJSON.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <string.h>
#include <math.h>       // NAN
}

// ── Global utility ──
void delay(unsigned long ms) {
    vTaskDelay(pdMS_TO_TICKS(ms));
}

// ── Helper: scan read results ──
namespace iotech_detail {
    inline float findNumberValue(const driver_value_t *values, uint8_t count, const char *key) { /* ... */ }
    inline bool  findBoolValue(const driver_value_t *values, uint8_t count, const char *key) { /* ... */ }
}

// ── 11 driver wrapper classes ──

class DHT22 { /* ... */ };
class Relay { /* ... */ };
class BME280 { /* ... */ };
class PIR { /* ... */ };
class HC_SR04 { /* ... */ };
class Buzzer { /* ... */ };
class SSD1306 { /* ... */ };
class LCD1602 { /* ... */ };
class WS2812B { /* ... */ };
class Servo { /* ... */ };
class DS18B20 { /* ... */ };
```

#### 2.1.5 io_driver Engine: Multi-Instance Support

To support `Relay` instances loading independently via `io_driver_load()`, the io_driver engine must allow multiple registrations of the same driver name when the driver declares itself as multi-instance capable.

**Change 1: Add `flags` to `driver_t`** (in `io_driver_types.h`):

```c
#define DRV_FLAG_MULTI_INSTANCE 0x01

typedef struct {
    const char     *name;
    const char     *description;
    uint8_t         flags;       // ← NEW field
    drv_err_t     (*init)(const driver_config_t *cfg);
    drv_err_t     (*read)(driver_value_t *values, uint8_t *count);
    drv_err_t     (*command)(const char *action, const void *arg);
    drv_err_t     (*deinit)(void);
} driver_t;
```

Drivers that can have multiple instances set `DRV_FLAG_MULTI_INSTANCE`: RELAY, SERVO, BUZZER, WS2812B. Single-instance sensors (DHT22, BME280, PIR, HC-SR04, DS18B20) leave flags=0.

**Change 2: Allow multi-instance loads** (in `io_driver.c`):

```c
drv_err_t io_driver_load(const char *name, const driver_config_t *cfg) {
    driver_t *driver = find_registered_driver(name);
    if (!driver) return DRV_ERR_NOT_FOUND;

    // Check if already loaded
    int existing = find_active_index(name);
    if (existing >= 0) {
        if (driver->flags & DRV_FLAG_MULTI_INSTANCE) {
            // Multi-instance: create disambiguated entry
            char key[DRV_MAX_KEY_LEN];
            snprintf(key, sizeof(key), "%s_%d", name, cfg->gpio);
            return load_and_init(key, driver, cfg);
        }
        // Single-instance: already loaded, no-op
        return DRV_OK;
    }

    return load_and_init(name, driver, cfg);
}
```

Each `Relay(pin, name)` → `io_driver_load("RELAY", &cfg)` → creates active entry `"RELAY_23"`. The wrapper stores this key and dispatches commands to it. The RELAY vtable is shared across all instances (same `driver_t*`), but `init()` is called per instance with its own GPIO.

**Change 3: Update `drv_relay.c`** — the `init()` function must accept `channels=1` per instance. The `command()` function already dispatches by relay number; when channels=1, relay number is always 1.

```c
// In drv_relay.c — init now handles single-channel per instance
drv_err_t relay_init(const driver_config_t *cfg) {
    uint8_t gpio = cfg->gpio;
    gpio_set_direction(gpio, GPIO_MODE_OUTPUT);
    gpio_set_level(gpio, 1); // active LOW: HIGH = off
    // Single channel per instance — store GPIO for this channel
    return DRV_OK;
}
```

**Why DRV_FLAG_MULTI_INSTANCE instead of always allowing multi-load:** Sensors like DHT22 share a hardware resource (a specific 1-wire bus). Loading DHT22 twice on different GPIOs is a hardware error — the flag prevents it at the engine level. Actuators like Relay are independent per GPIO — the flag enables it.

### 2.2 user_app.cpp

```cpp
// user_app.cpp — User-editable logic
// Generated by iotech AI. Edit freely.
#include <iotech.hpp>

// ── Global objects (AI-generated) ──

DHT22 dht(32);
Relay riego(23, "Bomba de riego");
// ... more driver instantiations

// ── Mandatory entry points ──

extern "C" void user_setup() {
    dht.begin();
    riego.begin();
    // ... begin all drivers
}

extern "C" void user_loop() {
    float temp = dht.readTemperature();
    float hum  = dht.readHumidity();

    if (temp >= 30.0f) {
        riego.on();
    } else {
        riego.off();
    }

    delay(2000);
}
```

The `extern "C"` linkage is essential because `main.c` is a C file and calls `user_setup()` and `user_loop()` as `void (*)(void)` function pointers. Without `extern "C"`, the C++ name mangling would prevent the linker from finding the symbols.

### 2.3 main.c Bridge

**Modified section in main.c:**

```c
// At top of main.c, after includes:
#ifdef __cplusplus
extern "C" {
#endif
extern void user_setup(void);
extern void user_loop(void);
#ifdef __cplusplus
}
#endif

// In app_main(), after io_driver_init() and driver registration:

    // Initialize relay GPIOs — shim delegates to io_driver
    relay_controller_init();

    // ── Call user setup (C++ code, extern "C" linked) ──
    user_setup();

    // Start the central state machine task
    sm_start();
```

**Where user_loop() runs:**

The state machine in `STATE_NORMAL` starts the `heartbeat_task` which publishes telemetry every 30s. The `user_loop()` should run in the same heartbeat task, right after `io_driver_collect_all()`:

```c
// In mqtt_manager.c, heartbeat_task():
static void heartbeat_task(void *arg)
{
    for (;;) {
        vTaskDelay(pdMS_TO_TICKS(HEARTBEAT_INTERVAL_MS));

        // ── Call user loop (C++ code) BEFORE collecting telemetry ──
        extern void user_loop(void);
        user_loop();

        /* Collect telemetry from all active io_driver drivers */
        cJSON *payload = io_driver_collect_all();
        // ... rest unchanged
    }
}
```

**Design decision: user_loop() runs in the heartbeat task, every 30s.**

Rationale: This is the natural telemetry-sensing cadence. The `user_loop()` is where the user's conditional logic runs — checking sensors and actuating relays. Running it right before telemetry collection ensures the published MQTT data reflects the latest user-driven actuation state.

**Alternative considered:** Run user_loop() in a separate FreeRTOS task with a user-configurable interval. Rejected for PR1 as over-engineering. The 30s heartbeat cadence is appropriate for most IoT use cases (temperature, humidity, water level). Can be made configurable in PR2.

### 2.4 io_driver Extension: io_driver_read_by_name()

```c
// In io_driver.h (NEW):
/**
 * Read values from a single active driver by name.
 * Searches the active list for a driver whose name matches.
 * @param name    Driver name (case-insensitive match against active list)
 * @param values  OUT: value array (caller provides DRV_MAX_VALUES slots)
 * @param count   OUT: number of values populated (0..DRV_MAX_VALUES)
 * @return DRV_OK, DRV_ERR_NOT_FOUND (not active), or driver->read() error
 */
drv_err_t io_driver_read_by_name(const char *name, driver_value_t *values, uint8_t *count);
```

```c
// In io_driver.c (NEW — ~25 lines):
drv_err_t io_driver_read_by_name(const char *name, driver_value_t *values, uint8_t *count)
{
    if (!name || !values || !count) return DRV_ERR_ARG;

    // Find active driver by name (case-insensitive)
    for (uint8_t i = 0; i < s_active_count; i++) {
        const driver_t *drv = s_active[i].driver;
        if (drv && drv->read && strcasecmp(drv->name, name) == 0) {
            return drv->read(values, count);
        }
    }
    return DRV_ERR_NOT_FOUND;
}
```

---

## 3. Backend Design

### 3.1 prompt-builder.js — C++ SDK Section

**Add to TEXTS object:**

```javascript
// ── New: C++ SDK section ─────────────────────────────────────────────────

cppSdk: {
  es: `## SDK de C++ (iotech.hpp)

Cada driver es una clase. El constructor toma pines GPIO / dirección I2C.
Todas las lecturas devuelven float (NaN si hay error).
Los actuadores usan métodos on()/off() o comandos específicos.

### Clases disponibles:

**Sensores:**
- \`DHT22 dht(pin)\` — Temperatura y humedad
  Métodos: \`dht.begin()\`, \`dht.readTemperature()\` → float (°C), \`dht.readHumidity()\` → float (%)
- \`BME280 bme(addr)\` — Temperatura, humedad, presión (I2C, addr default 0x76)
  Métodos: \`bme.begin()\`, \`bme.readTemperature()\`, \`bme.readHumidity()\`, \`bme.readPressure()\` → float (hPa)
- \`PIR pir(pin)\` — Sensor de movimiento digital
  Métodos: \`pir.begin()\`, \`pir.motionDetected()\` → bool
- \`HC_SR04 sr04(trigPin, echoPin)\` — Sensor de distancia ultrasónico
  Métodos: \`sr04.begin()\`, \`sr04.readDistance()\` → float (cm)
- \`DS18B20 ds18b20(pin)\` — Sensor de temperatura Dallas 1-wire
  Métodos: \`ds18b20.begin()\`, \`ds18b20.readTemperature()\` → float (°C)

**Actuadores:**
- \`Relay relay(pin, "nombre")\` — Control on/off (active LOW)
  Métodos: \`relay.begin()\`, \`relay.on()\`, \`relay.off()\`, \`relay.state()\` → bool
  ⚠️ Varios relays comparten el driver RELAY. Todos los Relay deben declararse antes de begin().
- \`Buzzer buzzer(pin)\` — Alarma sonora
  Métodos: \`buzzer.begin()\`, \`buzzer.beep(frecuenciaHz, duracionMs)\`
- \`Servo servo(pin)\` — Servomotor SG90/MG996R
  Métodos: \`servo.begin()\`, \`servo.setAngle(grados)\` — 0 a 180
- \`WS2812B leds(pin, numLeds)\` — Tira LED RGB
  Métodos: \`leds.begin()\`, \`leds.fill(r, g, b)\`, \`leds.set(indice, r, g, b)\`

**Displays:**
- \`SSD1306 oled(addr)\` — OLED 128x64 I2C (addr default 0x3C)
  Métodos: \`oled.begin()\`, \`oled.print("texto", linea)\`, \`oled.clear()\`
- \`LCD1602 lcd(addr)\` — LCD 16x2 I2C (addr default 0x27)
  Métodos: \`lcd.begin()\`, \`lcd.print("texto", linea)\`, \`lcd.clear()\`, \`lcd.setBacklight(true/false)\`

**Utilidad global:**
- \`void delay(uint32_t ms)\` — Espera sin bloquear otras tareas

### Estructura del código:

\`\`\`cpp
#include <iotech.hpp>

// 1. Declarar objetos GLOBALES (fuera de setup/loop)
DHT22 dht(32);
Relay bomba(23, "Bomba de agua");

// 2. setup() — inicializar todos los drivers
void setup() {
  dht.begin();
  bomba.begin();
}

// 3. loop() — lógica de automatización
void loop() {
  float temp = dht.readTemperature();
  if (temp >= 30.0) {
    bomba.on();
  } else {
    bomba.off();
  }
  delay(2000);
}
\`\`\`

⚠️ REGLAS:
- Los objetos DEBEN declararse como globales (fuera de setup/loop).
- Todos los begin() DEBEN llamarse en setup().
- La lógica de automatización va en loop().
- Usar delay() entre iteraciones de loop() (no bloquea WiFi/MQTT).
- Los pines GPIO DEBEN respetar el mapa de pines de la placa (ver arriba).
- Para I2C, SDA y SCL se toman automáticamente del board config.`,
  en: `## C++ SDK (iotech.hpp)
// ... English equivalent with same structure
`
},
```

**Extend outputFormat with code field:**

In both `es` and `en` versions of `TEXTS.outputFormat`, add the `"code"` field to the JSON example and add rules 13-14:

```
13. El campo "code" DEBE contener código C++ válido usando las clases de iotech.hpp.
14. El código DEBE declarar objetos globales, setup() con begin(), y loop() con la lógica.
```

The JSON example in the output format becomes:

```json
{
  "template": { "name": "...", "description": "..." },
  "drivers": [ ... ],
  "datastreams": [ ... ],
  "rules": [ ... ],
  "diagrama": "...",
  "code": "DHT22 dht(32);\nRelay bomba(23, \"Bomba\");\n\nvoid setup() {\n  dht.begin();\n  bomba.begin();\n}\n\nvoid loop() {\n  float t = dht.readTemperature();\n  if (t >= 30.0) bomba.on();\n  else bomba.off();\n  delay(2000);\n}"
}
```

### 3.2 examples.js — Extend with Code

Add `code` field to each of the 5 examples. Example for `dht22-thermal-control`:

```javascript
code: [
  '#include <iotech.hpp>',
  '',
  'DHT22 dht(32);',
  'Relay ventilador(23, "Ventilador");',
  '',
  'void setup() {',
  '  dht.begin();',
  '  ventilador.begin();',
  '}',
  '',
  'void loop() {',
  '  float temp = dht.readTemperature();',
  '  if (temp >= 30.0) {',
  '    ventilador.on();',
  '  } else {',
  '    ventilador.off();',
  '  }',
  '  delay(2000);',
  '}',
].join('\n'),
```

All 5 examples receive similar `code` fields with the correct drivers, pins, and logic from their respective configs.

### 3.3 ai.service.js — syncFromCpp()

```javascript
/**
 * Parse C++ code back to JSON config. Primary: LLM. Fallback: regex.
 *
 * @param {string} code — C++ source code from Monaco editor
 * @param {string} boardId — board ID for pin resolution
 * @returns {Promise<{ config, diagnostics }>}
 */
async function syncFromCpp(code, boardId) {
  const board = (boardId && require('./context/board-context').getBoard(boardId)) || getDefaultBoard();

  // Try LLM first
  const lang = detectLanguage(code); // use comment content
  const llmResult = await callSyncLLM(code, board, lang);
  if (llmResult) {
    const validation = validateAiConfig(llmResult.config);
    if (!validation.error) {
      return {
        config: validation.value,
        diagnostics: llmResult.diagnostics || {},
        _source: 'ai',
      };
    }
    logger.warn('[ai.service] LLM sync returned invalid config, falling back to regex');
  }

  // Regex fallback
  const fallback = regexParseCpp(code, board);
  return {
    config: fallback.config,
    diagnostics: fallback.diagnostics,
    _source: 'regex-fallback',
  };
}
```

#### 3.3.1 LLM Sync Prompt

```javascript
// In prompt-builder.js — new sync-specific text block:

syncPrompt: {
  es: `Eres un parser de código C++ de iotech. Tu tarea: analizar código C++ que usa iotech.hpp y extraer la configuración JSON equivalente.

Reglas:
1. Cada objeto global (ej: DHT22 dht(32)) → un entry en "drivers" con model + gpio/i2c_addr.
2. Cada Relay(n, "nombre") → un entry en drivers con channels: [{num, gpio, name}].
3. Las lecturas en loop() determinan qué datastreams se generan.
4. Los bloques if/else en loop() determinan las reglas (rules).
5. Generá el diagrama con las conexiones físicas (ESP32 GPIOx → Driver PIN).
6. Respondé ÚNICAMENTE con el JSON de configuración (mismo formato que generate).`,
  en: `// English equivalent`
},
```

#### 3.3.2 Regex Fallback Parser

```javascript
/**
 * Deterministic C++ code parser. Extracts drivers, pins, rules.
 * Runs in <10ms on server-side — no API call needed.
 */
function regexParseCpp(code, board) {
  const diagnostics = {
    drivers: [],
    conflicts: [],
    rules: [],
    unparseable: [],
  };

  // ── 1. Extract driver instantiations ──
  // Pattern: ClassName instanceName(args);
  const DRIVER_CLASSES = ['DHT22','BME280','Relay','PIR','HC_SR04','Buzzer','SSD1306','LCD1602','WS2812B','Servo','DS18B20'];
  const classPattern = new RegExp(
    `(${DRIVER_CLASSES.join('|')})\\s+(\\w+)\\s*\\(([^)]+)\\)`,
    'g'
  );

  let match;
  while ((match = classPattern.exec(code)) !== null) {
    const [, model, instance, argsStr] = match;
    const args = argsStr.split(',').map(s => s.trim().replace(/"/g, '').replace(/'/g, ''));

    let entry = { model, instance };

    if (model === 'DHT22' || model === 'PIR' || model === 'Buzzer' || model === 'Servo' || model === 'DS18B20') {
      entry.gpio = parseInt(args[0], 10);
    } else if (model === 'BME280' || model === 'SSD1306' || model === 'LCD1602') {
      entry.i2c_addr = args[0] || '0x76'; // default I2C addresses
    } else if (model === 'HC_SR04') {
      entry.gpio = parseInt(args[0], 10);
      entry.gpio2 = parseInt(args[1], 10);
    } else if (model === 'Relay') {
      entry.gpio = parseInt(args[0], 10);
      entry.name = args[1] || `Relay ${diagnostics.drivers.filter(d => d.model === 'Relay').length + 1}`;
      entry.channelNum = diagnostics.drivers.filter(d => d.model === 'Relay').length + 1;
    } else if (model === 'WS2812B') {
      entry.gpio = parseInt(args[0], 10);
      entry.numLeds = parseInt(args[1], 10);
    }

    diagnostics.drivers.push(entry);
  }

  // ── 2. Detect pin conflicts ──
  const pinUsage = {};
  diagnostics.drivers.forEach(d => {
    if (d.gpio !== undefined && !isNaN(d.gpio)) {
      if (!pinUsage[d.gpio]) pinUsage[d.gpio] = [];
      pinUsage[d.gpio].push(`${d.model} (${d.instance})`);
    }
  });
  Object.entries(pinUsage).forEach(([gpio, users]) => {
    if (users.length > 1) {
      diagnostics.conflicts.push({ gpio: parseInt(gpio), drivers: users });
    }
  });

  // ── 3. Extract rules from if blocks ──
  // Pattern: if (instance.method() operator value) { action.on/off() }
  const rulePattern = /if\s*\(\s*(\w+)\.(\w+)\(\)\s*([<>=!]+)\s*([\d.]+)\s*\)\s*\{([^}]+)\}/g;
  while ((match = rulePattern.exec(code)) !== null) {
    const [, instance, method, operator, value, body] = match;

    // Map method name to datastream key
    const methodKeyMap = {
      readTemperature: 'temperature',
      readHumidity: 'humidity',
      readPressure: 'pressure',
      motionDetected: 'motion',
      readDistance: 'distance',
    };
    const dsKey = methodKeyMap[method] || method;

    // Detect actions in body
    const actions = [];
    const onPattern = /(\w+)\.on\(\)/g;
    const offPattern = /(\w+)\.off\(\)/g;
    const beepPattern = /(\w+)\.beep\((\d+)/g;

    let am;
    while ((am = onPattern.exec(body)) !== null) {
      actions.push({ type: 'relay', instance: am[1], state: 'on' });
    }
    while ((am = offPattern.exec(body)) !== null) {
      actions.push({ type: 'relay', instance: am[1], state: 'off' });
    }
    while ((am = beepPattern.exec(body)) !== null) {
      actions.push({ type: 'buzzer', instance: am[1], tone: parseInt(am[2]) });
    }

    diagnostics.rules.push({
      condition: { datastream: dsKey, operator: operator, value: parseFloat(value) },
      actions,
    });
  }

  // ── 4. Reconstruct config from diagnostics ──
  const config = diagnosticsToConfig(diagnostics, board);

  return { config, diagnostics };
}
```

#### 3.3.3 Config Reconstruction

```javascript
function diagnosticsToConfig(diagnostics, board) {
  const drivers = [];
  const datastreams = [];
  const rules = [];

  // Group relays for shared RELAY driver
  const relayDrivers = diagnostics.drivers.filter(d => d.model === 'Relay');
  const relayChannels = relayDrivers.map((r, i) => ({
    num: i + 1,
    gpio: r.gpio,
    name: r.name,
  }));

  // Build drivers array
  diagnostics.drivers.forEach(d => {
    if (d.model === 'Relay') {
      if (drivers.find(dr => dr.model === 'RELAY')) return; // already added
      drivers.push({ model: 'RELAY', channels: relayChannels });
    } else if (d.model === 'BME280' || d.model === 'SSD1306' || d.model === 'LCD1602') {
      drivers.push({ model: d.model, i2c_addr: d.i2c_addr });
    } else if (d.model === 'HC_SR04') {
      drivers.push({ model: 'HC-SR04', gpio: d.gpio, gpio2: d.gpio2 });
    } else {
      drivers.push({ model: d.model, gpio: d.gpio });
    }
  });

  // Build datastreams from driver model + known datastream map
  const DRIVER_DATASTREAMS = {
    DHT22: [
      { key: 'temperature', name: 'Temperatura', type: 'number', unit: '°C', direction: 'input' },
      { key: 'humidity', name: 'Humedad', type: 'number', unit: '%', direction: 'input' },
    ],
    BME280: [
      { key: 'temperature', name: 'Temperatura', type: 'number', unit: '°C', direction: 'input' },
      { key: 'humidity', name: 'Humedad', type: 'number', unit: '%', direction: 'input' },
      { key: 'pressure', name: 'Presión', type: 'number', unit: 'hPa', direction: 'input' },
    ],
    PIR: [{ key: 'motion', name: 'Movimiento', type: 'boolean', unit: null, direction: 'input' }],
    'HC-SR04': [{ key: 'distance', name: 'Distancia', type: 'number', unit: 'cm', direction: 'input' }],
    DS18B20: [{ key: 'temperature', name: 'Temperatura', type: 'number', unit: '°C', direction: 'input' }],
  };

  diagnostics.drivers.forEach(d => {
    const dsTemplate = DRIVER_DATASTREAMS[d.model];
    if (!dsTemplate) return;
    dsTemplate.forEach(ds => {
      datastreams.push({
        ...ds,
        driver_name: d.model,
        gpio: d.gpio || null,
        i2c_addr: d.i2c_addr || null,
        config: {},
      });
    });
  });

  // Add relay datastreams
  relayChannels.forEach(ch => {
    datastreams.push({
      key: `relay${ch.num}`,
      name: ch.name,
      type: 'string',
      unit: null,
      direction: 'output',
      driver_name: 'RELAY',
      gpio: ch.gpio,
      i2c_addr: null,
      config: { channel: ch.num },
    });
  });

  // Build rules from diagnostics
  diagnostics.rules.forEach((r, i) => {
    const actions = r.actions.map(a => {
      if (a.type === 'relay') {
        const relay = relayDrivers.find(d => d.instance === a.instance);
        return {
          type: 'relay',
          relay: relay ? relay.channelNum : 1,
          state: a.state,
        };
      }
      if (a.type === 'buzzer') {
        return { type: 'buzzer', tone: a.tone };
      }
    }).filter(Boolean);

    rules.push({
      name: `Regla ${i + 1}`,
      description: `Automática: ${r.condition.datastream} ${r.condition.operator} ${r.condition.value}`,
      condition: r.condition,
      actions,
      cooldown_seconds: 60,
    });
  });

  // Generate diagram
  const lines = [];
  diagnostics.drivers.forEach(d => {
    if (d.model === 'BME280' || d.model === 'SSD1306' || d.model === 'LCD1602') {
      lines.push(`ESP32 GPIO${board.pins.i2c_sda} (SDA) → ${d.model} SDA`);
      lines.push(`ESP32 GPIO${board.pins.i2c_scl} (SCL) → ${d.model} SCL`);
    } else if (d.model === 'HC_SR04') {
      lines.push(`ESP32 GPIO${d.gpio} → ${d.model} TRIG`);
      lines.push(`ESP32 GPIO${d.gpio2} → ${d.model} ECHO`);
    } else if (d.model === 'Relay') {
      lines.push(`ESP32 GPIO${d.gpio} → ${d.name}`);
    } else {
      lines.push(`ESP32 GPIO${d.gpio} → ${d.model} DAT`);
    }
  });

  return {
    template: {
      name: `Configuración sincronizada`,
      description: `Generado desde código C++ — ${diagnostics.drivers.length} drivers`,
    },
    drivers,
    datastreams,
    rules,
    diagrama: lines.join('\\n'),
    _source: 'regex-fallback',
  };
}
```

### 3.4 POST /api/ai/sync Endpoint

```javascript
// In ai.routes.js
/**
 * POST /api/ai/sync
 * Parse C++ code back to JSON config.
 *
 * Body: { code: "DHT22 dht(32);\n...", boardId?: "ESP32_DEVKIT" }
 * Returns: { config: { template, drivers, datastreams, rules, diagrama }, diagnostics: { ... } }
 */
router.post('/sync', async (req, res, next) => {
  try {
    const { code, boardId } = req.body;
    if (!code || !code.trim()) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'code is required', status: 400 },
      });
    }

    // Basic syntax check: balanced braces
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      return res.status(422).json({
        error: {
          code: 'UNPARSEABLE_CODE',
          message: `Unbalanced braces: ${openBraces} open, ${closeBraces} close`,
          status: 422,
        },
      });
    }

    const result = await aiService.syncFromCpp(code.trim(), boardId);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});
```

### 3.5 ai.schemas.js — Schema Extension

```javascript
const aiConfig = Joi.object({
  template: template.required(),
  drivers: Joi.array().items(driver).default([]),
  datastreams: Joi.array().items(datastream).min(0).default([]),
  rules: Joi.array().items(rule).default([]),
  diagrama: Joi.string().allow(''),
  code: Joi.string().optional().allow(''),  // NEW: C++ code
});
```

**Design decision: `code` is optional and nullable.**

Rationale: Backward compatibility. Existing `/configure` requests without the C++ SDK in their prompt will still work. The schema uses `stripUnknown: true` in the existing `validateAiConfig()` — this strips `code` by default. **Need to change `stripUnknown` to `false`** so `code` passes through, or explicitly allow `code` to survive stripping.

Actually, looking at the existing code:

```javascript
const { error, value } = aiConfig.validate(config, { abortEarly: false, stripUnknown: true });
```

`stripUnknown: true` will strip any field not in the schema — including `code`. Need to change this to `stripUnknown: false` (or add `code` to the schema, which we're doing, so it passes through). The field is in the schema as `Joi.string().optional().allow('')`, so with `stripUnknown: true`, it WILL pass through because it's known. Wait — Joi's `stripUnknown` strips fields that are NOT in the schema. Since we're adding `code` to the schema, `code` is known and will NOT be stripped. This works.

---

## 4. Frontend Design

### 4.1 Dependencies

Add to `frontend/package.json`:

```json
{
  "dependencies": {
    "@monaco-editor/react": "^4.7.0",
    "monaco-editor": "^0.52.0"
  }
}
```

**Design decision: Use `@monaco-editor/react` wrapper over raw `monaco-editor`.**

Rationale: The wrapper handles React lifecycle, lazy loading, worker bundling (Web Workers for syntax highlighting), and provides a clean React API. The alternative — bundling Monaco directly — requires complex webpack/vite config for web workers.

### 4.2 CppEditor.tsx

```
Component Tree:
CppEditor
├── Monaco Editor (@monaco-editor/react)
│   └── language: "cpp"
│   └── theme: "vs-dark" (or app-matched via defineTheme)
│   └── options: { minimap: false, fontSize: 13, lineNumbers: "on", readOnly: false }
└── EditorToolbar
    ├── [Sync] button → POST /api/ai/sync
    ├── [Apply] button → sync if dirty → POST /api/ai/apply
    ├── Modified indicator (dot/asterisk)
    └── Source badge ("🤖 DeepSeek" / "📋 regex")
```

**Props interface:**

```typescript
interface CppEditorProps {
  code: string;                        // current code content
  onChange: (code: string) => void;    // called on every edit
  onSync: (config: AIConfig) => void;  // called after successful sync
  onApply: (result: ApplyResult) => void; // called after successful apply
  boardId?: string;
  isDirty: boolean;
}
```

**Lazy loading strategy:**

```typescript
import { lazy, Suspense } from "react";

const MonacoEditor = lazy(() => import("@monaco-editor/react"));

// In component:
<Suspense fallback={<LoadingSkeleton />}>
  <MonacoEditor ... />
</Suspense>
```

**Design decision: Use React.lazy() + dynamic import() for Monaco.**

Rationale: `@monaco-editor/react` supports lazy loading natively via its `loading` prop. Using `React.lazy()` wraps the entire editor component so the bundle is split. When the Code tab is first selected, Monaco downloads asynchronously. The `Suspense` fallback shows a skeleton/skeleton pulse animation during the ~2MB download.

**Monaco configuration:**

```typescript
<MonacoEditor
  language="cpp"
  theme="vs-dark"
  value={code}
  onChange={(value) => onChange(value || "")}
  options={{
    minimap: { enabled: false },
    fontSize: 13,
    fontFamily: "'Fira Code', 'Cascadia Code', monospace",
    lineNumbers: "on",
    scrollBeyondLastLine: false,
    wordWrap: "on",
    tabSize: 2,
    automaticLayout: true,
  }}
  loading={<div className="flex items-center justify-center h-96 text-muted-foreground">
    <Loader2 className="animate-spin h-5 w-5 mr-2" />
    Cargando editor...
  </div>}
/>
```

### 4.3 DiagnosticsPanel.tsx

```
DiagnosticsPanel
├── Section: Drivers Detected
│   ├── Item: model + instance name + pin/addr
│   └── Badge: count
├── Section: Pin Assignments
│   ├── Item: GPIO → [driver1, driver2]
│   └── Warning badge if conflict (!)
├── Section: Rules Extracted
│   ├── Item: condition + actions
│   └── Empty state if none detected
└── Section: Diagram
    └── Pre-formatted connection list
```

**Props:**

```typescript
interface DiagnosticsPanelProps {
  code: string;
  boardPinMap: BoardPinMap | null;  // fetched from catalog
}

interface DriverDiagnostic {
  model: string;
  instance: string;
  gpio?: number;
  i2c_addr?: string;
  channelNum?: number;
}

interface PinConflict {
  gpio: number;
  usedBy: string[];
  isInputOnly?: boolean;
  isUnavailable?: boolean;
}

interface RuleDiagnostic {
  condition: { datastream: string; operator: string; value: number };
  actions: { type: string; target: string; state?: string }[];
}
```

**Live regex parsing (client-side):**

The same regex patterns from the backend fallback (`regexParseCpp`) are replicated in TypeScript. They run in a `useMemo()` that depends on `code`, debounced at 300ms via a custom hook:

```typescript
function useDebouncedDiagnostics(code: string, boardPinMap: BoardPinMap | null) {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult>({});

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!code.trim()) {
        setDiagnostics({});
        return;
      }
      const result = parseCodeDiagnostics(code, boardPinMap);
      setDiagnostics(result);
    }, 300);  // 300ms debounce

    return () => clearTimeout(timer);
  }, [code, boardPinMap]);

  return diagnostics;
}
```

**Design decision: Debounce at 300ms, not per-keystroke.**

Rationale: The spec says sub-50ms per keystroke, but regex parsing on every keystroke is wasteful. A 300ms debounce gives the user a smooth typing experience while keeping diagnostics near-instant. The parse itself takes <5ms (simple regex on <5KB of text). The 300ms is for the debounce window, not the parse time.

**Pin conflict detection:**

The `boardPinMap` (fetched once from `GET /api/ai/catalog` or the board-context) provides:
- Which GPIOs are input-only (34-39 on ESP32)
- Which GPIOs are unavailable (strapping, flash)
- Default I2C SDA/SCL pins

```typescript
function detectPinConflicts(drivers: DriverDiagnostic[], boardPinMap: BoardPinMap): PinConflict[] {
  const conflicts: PinConflict[] = [];
  const gpioUsage: Record<number, string[]> = {};

  drivers.forEach(d => {
    if (d.gpio != null) {
      if (!gpioUsage[d.gpio]) gpioUsage[d.gpio] = [];
      gpioUsage[d.gpio].push(`${d.model} (${d.instance})`);
    }
  });

  // Add I2C pins for I2C drivers (SDA, SCL are implicitly used)
  drivers.forEach(d => {
    if (d.i2c_addr && boardPinMap) {
      const sda = boardPinMap.i2c_sda;
      const scl = boardPinMap.i2c_scl;
      if (!gpioUsage[sda]) gpioUsage[sda] = [];
      if (!gpioUsage[scl]) gpioUsage[scl] = [];
      gpioUsage[sda].push(`${d.model} (I2C SDA)`);
      gpioUsage[scl].push(`${d.model} (I2C SCL)`);
    }
  });

  Object.entries(gpioUsage).forEach(([gpio, users]) => {
    const gpioNum = parseInt(gpio);
    const conflict: PinConflict = { gpio: gpioNum, usedBy: users };

    if (users.length > 1) {
      conflicts.push(conflict);
    }

    // Check input-only pins for output drivers
    if (boardPinMap?.inputOnlyPins?.includes(gpioNum)) {
      const outputUsers = users.filter(u => u.includes('Relay') || u.includes('Buzzer') || u.includes('Servo'));
      if (outputUsers.length > 0) {
        conflicts.push({ ...conflict, isInputOnly: true });
      }
    }
  });

  return conflicts;
}
```

### 4.4 AIChat.tsx — Tabbed Layout

**State additions:**

```typescript
const [activeTab, setActiveTab] = useState<'chat' | 'code'>('chat');
const [generatedCode, setGeneratedCode] = useState<string | null>(null);
const [editedCode, setEditedCode] = useState<string | null>(null);
const [isCodeDirty, setIsCodeDirty] = useState(false);
const [syncedConfig, setSyncedConfig] = useState<AIConfig | null>(null);
```

**Flow when configure response arrives:**

```typescript
// In handleSubmit():
const res = await api.post('/api/ai/configure', { prompt: input.trim() });
setResult(res.data.data);
setGeneratedCode(res.data.data.code);  // NEW
setEditedCode(res.data.data.code);     // NEW
setIsCodeDirty(false);
```

**Tab navigation:**

```tsx
<div className="flex border-b border-[var(--border)] mb-4">
  <button
    onClick={() => setActiveTab('chat')}
    className={`px-4 py-2 text-sm ${activeTab === 'chat' ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]' : 'text-muted-foreground'}`}
  >
    💬 Asistente
  </button>
  <button
    onClick={() => setActiveTab('code')}
    className={`px-4 py-2 text-sm flex items-center gap-1 ${activeTab === 'code' ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]' : 'text-muted-foreground'}`}
    disabled={!generatedCode}
  >
    📝 Código C++
    {isCodeDirty && <span className="h-2 w-2 rounded-full bg-amber-500" />}
  </button>
</div>

{activeTab === 'chat' ? (
  <>{/* existing chat UI */}</>
) : (
  <CppEditor
    code={editedCode || ''}
    onChange={(v) => { setEditedCode(v); setIsCodeDirty(true); }}
    onSync={(config) => { setSyncedConfig(config); setIsCodeDirty(false); }}
    onApply={(result) => { setApplied(true); setAppliedData(result); }}
    boardId={boardId}
    isDirty={isCodeDirty}
  />
)}
```

### 4.5 Chat-Based Inline Editing (PR2)

This section outlines the design for PR2. Not implemented in PR1.

```
┌─────────────────────────────────────────────────────────┐
│  Code Tab                                               │
│  ┌──────────────────────────┬──────────────────────────┐│
│  │  Monaco Editor           │  Diagnostics             ││
│  │                          │                          ││
│  │  DHT22 dht(32);          │  ...                     ││
│  │  Relay riego(23);        │                          ││
│  └──────────────────────────┴──────────────────────────┘│
│  ┌─────────────────────────────────────────────────────┐│
│  │  💬 "cambia el relay al GPIO 19, agregale buzzer"  ││
│  │                                     [Enviar]        ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  ┌─ Diff Preview ──────────────────────────────────────┐│
│  │ - Relay riego(23, "Bomba");                         ││
│  │ + Relay riego(19, "Bomba");                         ││
│  │ + Buzzer alarma(13);                                ││
│  │ +                                                    ││
│  │ + if (temp > 40.0) { alarma.beep(1000, 500); }     ││
│  │                        [✓ Aplicar] [✗ Rechazar]     ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

**API: POST /api/ai/edit-code**

```javascript
// Request:
{
  code: "current full C++ code",
  instruction: "cambia el relay al GPIO 19, agregale buzzer en GPIO 13 que suene a 40°C",
  boardId: "ESP32_DEVKIT"
}

// Response:
{
  diff: [
    { type: 'remove', line: 2, content: 'Relay riego(23, "Bomba");' },
    { type: 'add', line: 2, content: 'Relay riego(19, "Bomba");' },
    { type: 'add', line: 4, content: 'Buzzer alarma(13);' },
    { type: 'add', line: 12, content: '  if (temp > 40.0) { alarma.beep(1000, 500); }' },
  ],
  newCode: "full resulting code with diff applied"
}
```

The LLM receives the current code + instruction and returns only the changed lines. The system prompt emphasizes: "Return only lines that change. Do not repeat unchanged code."

**Diff rendering:** Use Monaco's built-in diff editor mode via `@monaco-editor/react`:

```tsx
import { DiffEditor } from "@monaco-editor/react";

<DiffEditor
  original={editedCode}
  modified={newCode}
  language="cpp"
  options={{ readOnly: true, renderSideBySide: false }}
/>
```

The diff is shown inline (not side-by-side) to save horizontal space. The user clicks ✓ to apply or ✗ to reject. Applying replaces `editedCode` with `newCode`. Rejecting dismisses the diff.

---

## 5. File Structure Changes

### 5.1 New Files

```
firmware/include/iotech.hpp               # C++ wrapper classes (header-only)
firmware/src/user_app.cpp                 # User-editable logic template
frontend/src/features/ai/CppEditor.tsx    # Monaco editor component
frontend/src/features/ai/DiagnosticsPanel.tsx # Live diagnostics panel
openspec/changes/cpp-code-editor/
  ├── proposal.md                         # (already exists)
  ├── specs/cpp-code-editor/spec.md       # (already exists)
  └── design.md                           # (this file)
```

### 5.2 Modified Files

```
firmware/src/main.c                         # +user_setup() call
firmware/src/mqtt_manager.c                 # +user_loop() call in heartbeat
firmware/components/io_driver/io_driver.h   # +io_driver_read_by_name()
firmware/components/io_driver/io_driver.c   # +io_driver_read_by_name() impl
firmware/components/io_driver/io_driver.c   # +io_driver_read_by_name(), +multi-instance loading
backend/src/modules/ai/prompt-builder.js    # +cppSdk, +code in outputFormat
backend/src/modules/ai/examples.js          # +code field in all 5 examples
backend/src/modules/ai/ai.service.js        # +syncFromCpp(), +regexParseCpp()
backend/src/modules/ai/ai.routes.js         # +POST /sync route
backend/src/modules/ai/ai.schemas.js        # +code: Joi.string().optional()
frontend/src/features/ai/AIChat.tsx         # Tabbed layout, code state
frontend/package.json                       # +@monaco-editor/react
```

---

## 6. Decision Records

| # | Decision | Rationale | Alternatives Rejected |
|---|---|---|---|
| **DR1** | `iotech.hpp` is header-only | Wrappers are 3-5 line methods. Separate `.cpp` per class adds build complexity with zero benefit | `.cpp` per class — rejected for complexity |
| **DR2** | Add `io_driver_read_by_name()` to C API | `io_driver_collect_all()` returns heavy cJSON. Lightweight single-driver read needed for wrappers | Parse cJSON in wrappers — rejected for performance |
| **DR3** | Each Relay instance calls io_driver_load independently via DRV_FLAG_MULTI_INSTANCE | Consistent pattern — Relay::begin() works exactly like DHT22::begin(). No static state, no channel counting. io_driver engine extended to support multi-instance same-name loading | Shared RELAY driver with channel counting — rejected for inconsistency, breaks pattern |
| **DR4** | `extern "C"` on user_setup/user_loop | C++ name mangling breaks linkage from `main.c`. `extern "C"` resolves this | Compiling main.c as C++ — rejected, rest of framework is C |
| **DR5** | user_loop runs in heartbeat task, 30s cadence | Natural telemetry cadence. User logic runs before each MQTT publish | Separate FreeRTOS task — deferred to PR2 |
| **DR6** | `code` field returned in configure, ignored by apply | Backward compatible. Apply endpoint persists JSON config only; code is for user display/editing | Store code in BD — rejected, single source of truth |
| **DR7** | Sync = LLM primary, regex fallback | LLM understands semantics (relay names, rule logic). Regex is fast deterministic baseline | Regex-only — rejected, can't handle complex logic |
| **DR8** | Monaco lazy-loaded via React.lazy | 2MB bundle. Must not impact initial page TTI | Eager load — rejected for perf |
| **DR9** | Diagnostics debounced at 300ms | Smooth typing. Parse itself is <5ms | Per-keystroke — rejected for waste |
| **DR10** | Chat editing returns line-level diffs | LLM only returns changed lines. Preserves user's manual edits. Monaco DiffEditor for rendering | Full code generation — rejected, overwrites user edits |
| **DR11** | `stripUnknown: true` preserved in schema validation | Adding `code` to schema means it's NOT stripped. No change needed to existing validation | `stripUnknown: false` — unnecessary |

---

## 7. Test Strategy

### PR1 Tests

| Layer | Test | Type |
|---|---|---|
| Firmware | `io_driver_read_by_name` returns correct values for DHT22 | Unit (native) |
| Firmware | Multi-instance RELAY: 3 Relay objects load 3 independent instances | Unit (native) |
| Firmware | `iotech.hpp` compiles on all 4 board environments | Build |
| Firmware | `user_setup` / `user_loop` called from heartbeat task | Integration |
| Backend | `prompt-builder` output includes `cppSdk` section and `code` field | Unit |
| Backend | `syncFromCpp()` regex fallback extracts drivers, pins, rules | Unit |
| Backend | `syncFromCpp()` with valid C++ returns valid JSON config | Unit |
| Backend | `POST /sync` returns 422 for unbalanced braces | Integration |
| Backend | `POST /configure` returns `code` field (regression) | Integration |
| Backend | `POST /apply` succeeds with and without `code` field | Integration |
| Frontend | CppEditor renders Monaco when code is provided | Component |
| Frontend | Tab navigation preserves edited code | Component |

### PR2 Tests

| Layer | Test | Type |
|---|---|---|
| Frontend | DiagnosticsPanel detects DHT22 + Relay from code | Unit |
| Frontend | DiagnosticsPanel flags GPIO conflict (two drivers on same pin) | Unit |
| Frontend | DiagnosticsPanel flags input-only pin for relay | Unit |
| Frontend | Chat editing displays diff from LLM response | Component |
| Frontend | Approve diff updates Monaco content | Component |
| Frontend | Reject diff preserves original code | Component |
