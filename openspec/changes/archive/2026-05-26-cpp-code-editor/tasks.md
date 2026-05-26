# SDD Tasks: C++ Code Editor with Bidirectional AI Sync

**Change ID:** `cpp-code-editor`
**Phase:** Tasks
**Date:** 2026-05-23
**Chained PRs:** Yes — 2 PRs (PR1 Core, PR2 Enhancement)

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 380-430 (PR1: 250-280, PR2: 130-150) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR1 → PR2 |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

---

## Task Dependency Graph

```
PR1: Core
═══════════════════════════════════════════════
TASK-FW01 (io_driver_types.h flags)
  └── TASK-FW02 (io_driver.c multi-instance)
  └── TASK-FW03 (drv_relay.c per-instance)
       └── TASK-FW04 (io_driver_read_by_name)
            └── TASK-FW05 (iotech.hpp wrappers)
                 └── TASK-FW06 (user_app.cpp + main.c bridge)
                      └── TASK-FW07 (compile 4 boards)

TASK-BE01 (prompt-builder cppSdk + code)
  └── TASK-BE02 (examples.js code fields)
  └── TASK-BE03 (syncFromCpp + regex fallback)
       └── TASK-BE04 (POST /sync route)
            └── TASK-BE05 (ai.schemas.js code field)

TASK-FE01 (AIChat tabbed layout)
TASK-FE02 (CppEditor + Monaco lazy-load)
TASK-FE03 (Sync button wiring)

PR2: Enhancement
═══════════════════════════════════════════════
TASK-FE04 (DiagnosticsPanel live regex)
TASK-FE05 (Chat inline editing with diffs)
TASK-FE06 (Pin conflict visualization)

PR1 tasks can run in 3 parallel streams:
  Stream A: FW01→FW02→FW03→FW04→FW05→FW06→FW07
  Stream B: BE01→BE02, BE03→BE04→BE05 (BE01/BE02 parallel)
  Stream C: FE01→FE02→FE03
PR2 depends on PR1 merge.
```

---

## PR1: Core — C++ Wrappers + Sync + Monaco Editor

### TASK-FW01: Add DRV_FLAG_MULTI_INSTANCE to driver_t [PR1] [P0]

**Files:** `firmware/components/io_driver/include/io_driver_types.h`
**Lines:** ~8
**Depends on:** None
**Spec:** SPEC-CCE-007

Add `uint8_t flags` field to `driver_t` struct and `#define DRV_FLAG_MULTI_INSTANCE 0x01`.

```c
#define DRV_FLAG_MULTI_INSTANCE 0x01

typedef struct {
    const char     *name;
    const char     *description;
    uint8_t         flags;       // ← NEW (before init)
    drv_err_t     (*init)(const driver_config_t *cfg);
    drv_err_t     (*read)(driver_value_t *values, uint8_t *count);
    drv_err_t     (*command)(const char *action, const void *arg);
    drv_err_t     (*deinit)(void);
} driver_t;
```

**Tests:** RED → Verify struct layout with `sizeof(driver_t)` alignment. GREEN → Define flag and verify compile. TRIANGULATE → Verify flag 0 for DHT22 (single-instance), flag set for RELAY.

---

### TASK-FW02: Multi-instance loading in io_driver_load() [PR1] [P0]

**Files:** `firmware/components/io_driver/io_driver.c`
**Lines:** ~25
**Depends on:** TASK-FW01

Modify `io_driver_load()`: when a driver with `DRV_FLAG_MULTI_INSTANCE` is already loaded and called again with a different GPIO, create a disambiguated active entry keyed `"DRIVERNAME_GPIO"`.

Logic:
1. If driver already loaded AND has flag → disambiguate by `snprintf(key, ..., "%s_%d", name, cfg->gpio)`
2. If single-instance AND already loaded → no-op (return DRV_OK)
3. Otherwise → normal load

**Tests:** RED → test `io_driver_load("RELAY", &cfg_gpio23)` twice returns DRV_OK both times with different active entries. GREEN → implement gating logic. TRIANGULATE → test DHT22 (single-instance) loading twice is a no-op.

---

### TASK-FW03: Update drv_relay.c for per-instance init [PR1] [P0]

**Files:** `firmware/components/drv_relay/drv_relay.c`
**Lines:** ~15
**Depends on:** TASK-FW02

Set `DRV_FLAG_MULTI_INSTANCE` in the RELAY `driver_t` struct. Update `relay_init()` to handle `channels=1` per instance:

```c
drv_err_t relay_init(const driver_config_t *cfg) {
    uint8_t gpio = cfg->gpio;
    gpio_set_direction(gpio, GPIO_MODE_OUTPUT);
    gpio_set_level(gpio, 1); // active LOW: HIGH = off
    return DRV_OK;
}
```

The `command()` function already dispatches by relay number — when channels=1, relay=1 is always correct.

**Tests:** RED → verify relay_init accepts channels=1. GREEN → compile and verify GPIO config. TRIANGULATE → 2 Relay objects on different GPIOs each configure their own pin independently.

---

### TASK-FW04: Add io_driver_read_by_name() [PR1] [P0]

**Files:** `firmware/components/io_driver/include/io_driver.h`, `firmware/components/io_driver/io_driver.c`
**Lines:** ~30
**Depends on:** TASK-FW02

New function `drv_err_t io_driver_read_by_name(const char *name, driver_value_t *values, uint8_t *count)`. Searches the active driver list by name (case-insensitive via `strcasecmp`) and calls `driver->read()`, returning raw value array. Returns `DRV_ERR_NOT_FOUND` if not active.

This is the lightweight alternative to `io_driver_collect_all()` (which returns heavy cJSON). Used by C++ wrappers for per-driver reads.

**Tests:** RED → call with inactive driver name, expect DRV_ERR_NOT_FOUND. GREEN → activate DHT22, call read_by_name, verify temperature/humidity values populated. TRIANGULATE → call with case variations ("dht22", "DHT22", "Dht22").

---

### TASK-FW05: Create iotech.hpp with 11 wrapper classes [PR1] [P0]

**Files:** `firmware/include/iotech.hpp` (NEW)
**Lines:** ~180
**Depends on:** TASK-FW04, TASK-FW03

Header-only C++ file. Structure:

1. `extern "C"` includes: `io_driver_types.h`, `io_driver.h`, `io_board.h`, `cJSON.h`, FreeRTOS headers
2. `iotech_detail::findNumberValue()` / `findBoolValue()` helpers
3. `void delay(unsigned long ms)` — wraps `vTaskDelay`
4. 11 wrapper classes:

| Class | Constructor | begin() | Read/Command methods |
|---|---|---|---|
| DHT22 | `DHT22(pin)` | load `"DHT22"` | `readTemperature()`, `readHumidity()` |
| Relay | `Relay(pin, name)` | load `"RELAY"` (disambiguated) | `on()`, `off()`, `state()` |
| BME280 | `BME280(addr=0x76)` | load `"BME280"` via I2C | `readTemperature()`, `readHumidity()`, `readPressure()` |
| PIR | `PIR(pin)` | load `"PIR"` | `motionDetected()` |
| HC_SR04 | `HC_SR04(trig, echo)` | load `"HC-SR04"` | `readDistance()` |
| Buzzer | `Buzzer(pin)` | load `"BUZZER"` | `beep(freq, ms)` |
| SSD1306 | `SSD1306(addr=0x3C)` | load `"SSD1306"` I2C | `print(text, line)`, `clear()` |
| LCD1602 | `LCD1602(addr=0x27)` | load `"LCD1602"` I2C | `print(text, line)`, `clear()`, `setBacklight(bool)` |
| WS2812B | `WS2812B(pin, count)` | load `"WS2812B"` | `fill(r,g,b)`, `set(i,r,g,b)` |
| Servo | `Servo(pin)` | load `"SERVO"` | `setAngle(degrees)` |
| DS18B20 | `DS18B20(pin)` | load `"DS18B20"` | `readTemperature()` |

Each class delegates to `io_driver_load()` in `begin()`, `io_driver_read_by_name()` for sensors, and `io_driver_dispatch_command()` for actuators. Error handling: read methods return `NAN` (float) or `false` (bool) on failure. Commands are no-ops if not ready.

**Tests:** RED → compile `iotech.hpp` in isolation (header-only). GREEN → link with firmware framework. TRIANGULATE → test DHT22 read cycle on native test env, Relay on/off cycle on native test env.

---

### TASK-FW06: Create user_app.cpp and main.c bridge [PR1] [P0]

**Files:** `firmware/src/user_app.cpp` (NEW), `firmware/src/main.c`, `firmware/src/mqtt_manager.c`
**Lines:** ~30
**Depends on:** TASK-FW05

Create `user_app.cpp` with `extern "C"` entry points:

```cpp
// user_app.cpp
#include <iotech.hpp>

extern "C" void user_setup() {
    // AI-generated driver initialization
}

extern "C" void user_loop() {
    // AI-generated logic
}
```

Modify `main.c`: add `extern void user_setup(void)` (under `extern "C"` guards for C++ compat) and call `user_setup()` after `io_driver_init()`.

Modify `mqtt_manager.c`: in `heartbeat_task()`, add `extern void user_loop(void)` and call `user_loop()` right before `io_driver_collect_all()`.

**Tests:** RED → verify `user_setup` symbol is resolved at link time. GREEN → verify `user_setup` is called during boot. TRIANGULATE → verify `user_loop` runs before each MQTT publish (check telemetry values updated after loop).

---

### TASK-FW07: Verify compilation on all 4 boards [PR1] [P0]

**Files:** `firmware/platformio.ini` (no changes expected)
**Lines:** ~0
**Depends on:** TASK-FW06

Build `iotech.hpp` + `user_app.cpp` on all 4 environments: `esp32dev`, `esp32s3`, `esp32c3`, `esp32cam`. Verify zero build errors, zero warnings. ESP-IDF toolchain supports `.cpp` natively — no `platformio.ini` changes expected.

**Tests:** Build-only. No runtime tests needed. Each board environment compiles + links successfully.

---

### TASK-BE01: Extend prompt-builder with C++ SDK section [PR1] [P0]

**Files:** `backend/src/modules/ai/context/prompt-builder.js`
**Lines:** ~60
**Depends on:** None
**Spec:** SPEC-CCE-001

1. Add `TEXTS.cppSdk` block (es + en) documenting the 11 wrapper classes, their constructors, methods, and code structure rules
2. Extend `TEXTS.outputFormat` (es + en): add `"code"` field to the JSON example and rules 13-14
3. Add `cppSdk` section to `buildSystemPrompt()` assembly (after `driverContext`, before `rulesSection`)

**Tests:** RED → verify `buildSystemPrompt()` output contains `iotech.hpp` in generated system prompt. GREEN → verify `"code"` field appears in outputFormat example. TRIANGULATE → verify Spanish prompt uses Spanish class descriptions, English prompt uses English.

---

### TASK-BE02: Extend few-shot examples with C++ code [PR1] [P0]

**Files:** `backend/src/modules/ai/context/examples.js`
**Lines:** ~50
**Depends on:** TASK-BE01
**Spec:** SPEC-CCE-001

Add `code` field to all 5 examples (`dht22-thermal-control`, `bme280-weather-station`, `pir-buzzer-alarm`, `hcsr04-distance-relay`, `esp32c3-dht22-relay`). Each `code` string is valid C++ using `iotech.hpp` classes, with correct GPIOs from the board context, and logic matching the config's rules.

**Tests:** RED → verify each example has a non-empty `code` string. GREEN → verify `code` strings contain the correct driver class names. TRIANGULATE → verify `getExamples({ board: "ESP32_C3" })` returns C3-specific code.

---

### TASK-BE03: Implement syncFromCpp() with LLM + regex fallback [PR1] [P0]

**Files:** `backend/src/modules/ai/ai.service.js` (modified), `backend/src/modules/ai/context/prompt-builder.js` (add `syncPrompt` block)
**Lines:** ~120
**Depends on:** TASK-BE01
**Spec:** SPEC-CCE-002

Implement `syncFromCpp(code, boardId)`:

1. **LLM primary path:** Build a sync-specific system prompt (`TEXTS.syncPrompt`) with instruction "parse this C++ code → JSON config". Call DeepSeek with the code. Same `validateAiConfig()` validation as configure.
2. **Regex fallback:** `regexParseCpp(code, board)` — deterministic parser extracting:
   - Driver instantiations (regex: `ClassName instanceName(args)`)
   - Pin conflicts (duplicate GPIO usage)
   - Rules from `if` blocks (`if (instance.method() op val) { action.on/off() }`)
   - Config reconstruction via `diagnosticsToConfig()`
3. Return `{ config, diagnostics, _source }`

Add `TEXTS.syncPrompt` to `prompt-builder.js` (es + en).

**Tests:** RED → `regexParseCpp("DHT22 dht(32);\nRelay r(23, \"Bomba\");")` returns config with 2 drivers. GREEN → `regexParseCpp()` detects pin conflict on GPIO 23. TRIANGULATE → `regexParseCpp()` extracts rules from `if (dht.readTemperature() >= 30.0) { r.on(); }`.

---

### TASK-BE04: Create POST /api/ai/sync endpoint [PR1] [P0]

**Files:** `backend/src/modules/ai/ai.routes.js`
**Lines:** ~30
**Depends on:** TASK-BE03
**Spec:** SPEC-CCE-002

```javascript
router.post('/sync', async (req, res, next) => {
  try {
    const { code, boardId } = req.body;
    if (!code || !code.trim()) return res.status(400).json({...});
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) return res.status(422).json({...});
    const result = await aiService.syncFromCpp(code.trim(), boardId);
    res.json({ data: result });
  } catch (err) { next(err); }
});
```

Auth: uses existing `authGuard` + `tenantResolver` middleware chain.

**Tests:** RED → POST `/sync` without `code` returns 400. GREEN → POST valid C++ returns valid JSON config. TRIANGULATE → POST unbalanced braces returns 422.

---

### TASK-BE05: Add code field to ai.schemas.js [PR1] [P1]

**Files:** `backend/src/modules/ai/ai.schemas.js`
**Lines:** ~3
**Depends on:** None
**Spec:** SPEC-CCE-006

Add `code: Joi.string().optional().allow('')` to the `aiConfig` schema. Since `stripUnknown: true` only strips fields NOT in the schema, and `code` is now in the schema, it passes through validation.

**Tests:** RED → validate config with `code` field passes. GREEN → validate config without `code` field passes (backward compat). TRIANGULATE → validate config with `code: ""` passes.

---

### TASK-FE01: Add tabbed layout to AIChat.tsx [PR1] [P0]

**Files:** `frontend/src/features/ai/AIChat.tsx`
**Lines:** ~50
**Depends on:** None
**Spec:** SPEC-CCE-003

Add tab state and navigation:
- `activeTab: 'chat' | 'code'`
- Chat tab = existing UI (unchanged)
- Code tab = placeholder (wired in TASK-FE02)
- Code tab disabled until generatedCode exists
- Dirty indicator (amber dot) when code edited
- On configure response: save `generatedCode` + `editedCode`

Add state fields: `generatedCode`, `editedCode`, `isCodeDirty`, `syncedConfig`.

**Tests:** RED → tab state toggles between 'chat' and 'code'. GREEN → code tab disabled when `generatedCode` is null. TRIANGULATE → dirty indicator appears after `onChange` fires.

---

### TASK-FE02: Create CppEditor component with Monaco [PR1] [P0]

**Files:** `frontend/src/features/ai/CppEditor.tsx` (NEW), `frontend/package.json`
**Lines:** ~60
**Depends on:** TASK-FE01
**Spec:** SPEC-CCE-003

Install `@monaco-editor/react` + `monaco-editor`:

```bash
cd frontend && npm install @monaco-editor/react monaco-editor
```

Create `CppEditor.tsx`:
- `MonacoEditor` from `@monaco-editor/react` wrapped in `React.lazy()` + `Suspense`
- Language: `"cpp"`, theme: `"vs-dark"` (or custom matching app theme)
- Options: minimap disabled, fontSize 13, lineNumbers on, wordWrap on, scrollBeyondLastLine false
- Loading skeleton while Monaco downloads (~2MB, deferred)
- Props: `code`, `onChange`, `onSync`, `onApply`, `boardId`, `isDirty`
- Sync button → POST `/api/ai/sync` → update `syncedConfig`
- Apply button → sync if dirty → POST `/api/ai/apply`
- Modified indicator + source badge

**Tests:** RED → Monaco renders when `code` prop is provided. GREEN → typing triggers `onChange`. TRIANGULATE → sync button calls POST `/sync` with current code.

---

### TASK-FE03: Wire tab navigation and sync/apply in AIChat [PR1] [P1]

**Files:** `frontend/src/features/ai/AIChat.tsx`
**Lines:** ~25
**Depends on:** TASK-FE01, TASK-FE02
**Spec:** SPEC-CCE-006

Connect CppEditor to AIChat state:
- Pass `editedCode` as `code` prop
- `onChange` → setEditedCode, mark dirty
- `onSync` → setSyncedConfig, clear dirty
- `onApply` → set applied state (reuse existing `applied`/`appliedData`)
- Configure response saves `generatedCode` + `editedCode`
- Existing `_source` badge reused in Code tab

**Tests:** RED → switching to code tab shows generated code in Monaco. GREEN → editing code marks dirty (amber dot on tab). TRIANGULATE → applying after editing triggers sync-first-then-apply.

---

## PR2: Enhancement — Live Diagnostics + Chat Editing

### TASK-FE04: Create DiagnosticsPanel with live regex parsing [PR2] [P1]

**Files:** `frontend/src/features/ai/DiagnosticsPanel.tsx` (NEW)
**Lines:** ~80
**Depends on:** TASK-FE02 (PR1 merged)
**Spec:** SPEC-CCE-004

Client-side regex parser (TypeScript port of `regexParseCpp`):
- `useDebouncedDiagnostics(code, boardPinMap)` — debounced at 300ms
- Detects: driver declarations, pin assignments, pin conflicts, input-only violations, extracted rules
- Renders collapsed sections: Drivers, Pin Assignments, Rules, Diagram
- Each section with badge count
- Conflicts highlighted in amber/red
- Empty states with "No {X} detected" text
- `boardPinMap` fetched from board context (reuse catalog API data)

**Tests:** RED → "DHT22 dht(32);" → diagnostics detects 1 driver. GREEN → "DHT22 dht(32);\nRelay r(32, \"test\");" → diagnostics flags GPIO 32 conflict. TRIANGULATE → input-only pin (34-39) used for relay → diagnostics flags input-only violation.

---

### TASK-FE05: Integrate DiagnosticsPanel into CppEditor layout [PR2] [P1]

**Files:** `frontend/src/features/ai/CppEditor.tsx`
**Lines:** ~20
**Depends on:** TASK-FE04
**Spec:** SPEC-CCE-004

Add DiagnosticsPanel beside Monaco in a side-by-side or bottom layout:
- Desktop: side-by-side (Monaco left, DiagnosticsPanel right)
- Mobile: tabs or accordion (Monaco top, DiagnosticsPanel below)
- Pass `code` and `boardPinMap` to DiagnosticsPanel
- Sync results inject diagnostics from LLM (optional: merge LLM diagnostics with local regex)

**Tests:** RED → DiagnosticsPanel renders beside Monaco when code contains driver declarations. GREEN → editing code updates diagnostics within 300ms. TRIANGULATE → diagnostics empty when code has no driver declarations.

---

### TASK-FE06: Chat-based inline editing with diffs [PR2] [P2]

**Files:** `frontend/src/features/ai/CppEditor.tsx`, `frontend/src/features/ai/AIChat.tsx`
**Lines:** ~60
**Depends on:** TASK-FE03 (PR1 merged)
**Spec:** SPEC-CCE-005

Add chat input in Code tab:
- User: "change relay to GPIO 19" → POST `/configure` (or dedicated endpoint) with chat instruction + current code context
- AI returns only the changed lines (diff), not full code
- Monaco `DiffEditor` shows before/after
- [Approve] applies diff → updates code
- [Reject] discards diff → preserves original
- Multiple changes in one response: all shown in diff, approve applies all
- Comment preservation: AI instructions emphasize preserving user comments

**Tests:** RED → send chat instruction, receive diff response. GREEN → DiffEditor shows line-level changes. TRIANGULATE → reject diff preserves original code untouched.

---

## Task Summary

### PR1 Core — 14 tasks (total ~270 lines estimated)

| Task | Layer | Priority | Lines | Dependencies |
|---|---|---|---|---|
| TASK-FW01 | Firmware | P0 | 8 | None |
| TASK-FW02 | Firmware | P0 | 25 | FW01 |
| TASK-FW03 | Firmware | P0 | 15 | FW02 |
| TASK-FW04 | Firmware | P0 | 30 | FW02 |
| TASK-FW05 | Firmware | P0 | 180 | FW04, FW03 |
| TASK-FW06 | Firmware | P0 | 30 | FW05 |
| TASK-FW07 | Firmware | P0 | 0 | FW06 |
| TASK-BE01 | Backend | P0 | 60 | None |
| TASK-BE02 | Backend | P0 | 50 | BE01 |
| TASK-BE03 | Backend | P0 | 120 | BE01 |
| TASK-BE04 | Backend | P0 | 30 | BE03 |
| TASK-BE05 | Backend | P1 | 3 | None |
| TASK-FE01 | Frontend | P0 | 50 | None |
| TASK-FE02 | Frontend | P0 | 60 | FE01 |
| TASK-FE03 | Frontend | P1 | 25 | FE01, FE02 |

### PR2 Enhancement — 3 tasks (total ~160 lines estimated)

| Task | Layer | Priority | Lines | Dependencies |
|---|---|---|---|---|
| TASK-FE04 | Frontend | P1 | 80 | FE02 (PR1) |
| TASK-FE05 | Frontend | P1 | 20 | FE04 |
| TASK-FE06 | Frontend | P2 | 60 | FE03 (PR1) |

### Spec Coverage

| Spec | PR1 Tasks | PR2 Tasks |
|---|---|---|
| SPEC-CCE-001 (C++ generation) | BE01, BE02 | — |
| SPEC-CCE-002 (Bidirectional sync) | BE03, BE04 | — |
| SPEC-CCE-003 (Monaco editor) | FE01, FE02, FE03 | — |
| SPEC-CCE-004 (Live diagnostics) | — | FE04, FE05 |
| SPEC-CCE-005 (Chat editing) | — | FE06 |
| SPEC-CCE-006 (Backward compat) | BE05, FE03 | — |
| SPEC-CCE-007 (FW wrappers) | FW01–FW07 | — |

---

## TDD Notes

All tasks follow strict TDD: **RED → GREEN → TRIANGULATE**

### PR1 Test Execution Order

1. **FW01-FW07:** `cd firmware && pio test -e native` (unit tests for io_driver engine), `pio run -e esp32dev -e esp32s3 -e esp32c3 -e esp32cam` (build tests)
2. **BE01-BE05:** `cd backend && npm test -- --testPathPattern="ai"` (unit + integration tests for sync/regex/prompt-builder)
3. **FE01-FE03:** `cd frontend && npm test -- --testPathPattern="AIChat|CppEditor"` (component tests for tab layout, Monaco rendering, sync wiring)

### PR2 Test Execution Order

1. **FE04-FE05:** `cd frontend && npm test -- --testPathPattern="DiagnosticsPanel"` (unit tests for regex parsing, pin conflict detection)
2. **FE06:** `cd frontend && npm test -- --testPathPattern="AIChat"` (component tests for diff display, approve/reject)
