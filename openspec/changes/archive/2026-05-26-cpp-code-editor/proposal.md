# SDD Proposal: C++ Code Editor with Bidirectional AI Sync

**Change ID:** `cpp-code-editor`
**Status:** Proposed
**Author:** SDD Propose Executor
**Date:** 2026-05-23

---

## Summary

Extend the ioTech AI assistant to generate **C++ code** alongside the existing JSON configuration. Add a **Monaco editor** in the frontend where installers can read, verify, and edit the generated code. Enable **bidirectional sync**: when the user edits the C++ code and clicks "Sync", the AI parses it back into the JSON config (drivers, datastreams, rules, diagram). Complement with a **live diagnostics panel** that detects driver declarations, pin conflicts, and extracted rules in real time, plus **chat-based inline editing** for targeted code changes via natural language.

---

## Motivation

### Problem

1. **Black-box trust gap.** The current AI assistant returns a JSON config that the installer never reads. They trust the AI got it right — but they can't verify pin assignments, rule logic, or driver selection without scrolling through JSON fields.

2. **No editing for developers.** Installers who know C++ (common in the Arduino/ESP32 niche) have no way to refine or customize the generated logic. The JSON is read-only in practice.

3. **Language mismatch.** The target audience — Arduino/PlatformIO developers — expects C++ with classes and objects (`DHT22 dht(32)`), not JSON or raw C vtable configuration. The firmware is C today, but the user-facing API should be C++.

### Opportunity

- **C++ code as a contract of understanding.** A 5-second code read confirms the AI understood the request:
  ```cpp
  DHT22 dht(32);                     // ✅ My pin 32
  Relay riego(23, "Bomba de riego"); // ✅ Pump on relay 1
  if (hum < 30.0) { riego.on(); }   // ✅ Irrigate when dry
  ```

- **Bidirectional flow.** The C++ is the single source of truth. User edits it → AI regenerates JSON. The user never touches JSON — they just read and edit C++.

- **Small surface area.** The prompt-builder already does 80% of the work (board context, driver catalog, few-shot examples). Adding a C++ SDK section and a `code` output field is incremental.

---

## Scope

### In Scope

| Layer | What | Why |
|---|---|---|
| **Firmware** | `iotech.hpp` — C++ wrapper classes (~11 drivers: DHT22, Relay, BME280, PIR, HC-SR04, Buzzer, SSD1306, LCD1602, WS2812B, SERVO, DS18B20) | Expose idiomatic C++ API over the C vtable drivers. `io_driver_types.h` already has `extern "C"` guards. |
| **Firmware** | `user_app.cpp` — compiled entry point with `void setup()` / `void loop()` | User-editable logic, separate from framework `main.c` |
| **Firmware** | `main.c` — add `extern user_setup()` / `extern user_loop()` calls | Bridge C framework ↔ C++ user code |
| **Backend** | `prompt-builder.js` — new `cppSdk` section documenting the C++ API for the LLM | Teach the AI what C++ classes/methods are available |
| **Backend** | `prompt-builder.js` — extend `outputFormat` with `"code"` field containing C++ | LLM returns C++ code alongside JSON |
| **Backend** | `examples.js` — add `code` field to all 5 few-shot examples | LLM learns C++ generation from real working examples |
| **Backend** | `ai.service.js` — new `syncFromCpp(code)` function | Parse C++ → JSON config (LLM + regex fallback) |
| **Backend** | `ai.routes.js` — new `POST /api/ai/sync` endpoint | API for frontend sync |
| **Backend** | `ai.schemas.js` — add optional `code: Joi.string()` to config schema | Validation |
| **Frontend** | `@monaco-editor/react` dependency | Code editor with syntax highlighting, diff, autocomplete |
| **Frontend** | `CppEditor.tsx` — Monaco editor component | Tabbed view with Chat / Code tabs in AIChat |
| **Frontend** | `DiagnosticsPanel.tsx` — live regex-based diagnostics | Driver detection, pin conflicts, rule extraction — instant, no API call |
| **Frontend** | Chat-based inline editing (Phase 2) | User: "change relay to GPIO 19" → AI edits code with diff preview |
| **Frontend** | `AIChat.tsx` — tabbed layout, Monaco lazy-load, sync button | Integration |

### Out of Scope

- **C++ standard library (STL).** ESP32 memory constraints. Wrapper classes are header-only, no heap, no templates beyond constructor overloading.
- **Web-based compilation.** Compilation remains on the installer's machine via PlatformIO or the existing flash wizard. The editor shows code only.
- **Rewriting firmware drivers in C++.** The 32 C drivers stay as-is. Wrappers are a thin `extern "C"` layer.
- **Real-time collaborative editing.** Single-user editor. Not Google Docs for C++.
- **AI suggests code changes while user types.** Diagnostics are regex-based (instant). AI sync is explicit (button click).

---

## What Changes

### Firmware

```
firmware/
├── include/
│   └── iotech.hpp          ← NEW: C++ wrapper classes
├── src/
│   ├── main.c              ← MODIFIED: add extern user_setup/user_loop
│   └── user_app.cpp        ← NEW: user-editable logic
```

**`iotech.hpp` design:**
```cpp
#pragma once
extern "C" {
#include "io_driver_types.h"
}

class DHT22 {
  uint8_t _pin;
public:
  DHT22(uint8_t pin) : _pin(pin) {}
  void begin();
  float readTemperature();
  float readHumidity();
};

class Relay {
  uint8_t _pin;
  const char* _name;
  bool _state = false;
public:
  Relay(uint8_t pin, const char* name) : _pin(pin), _name(name) {}
  void on();
  void off();
  bool state() const;
};

class BME280 {
  uint8_t _addr;
public:
  BME280(uint8_t addr = 0x76) : _addr(addr) {}
  void begin();
  float readTemperature();
  float readHumidity();
  float readPressure();
};

// ... PIR, HC_SR04, Buzzer, SSD1306, LCD1602, WS2812B, SERVO, DS18B20 ...
void delay(unsigned long ms); // wraps vTaskDelay
```

Each method calls `io_driver_read()` / `io_driver_command()` through the existing C vtable. Zero driver rewrites.

### Backend

| File | Change |
|---|---|
| `prompt-builder.js` | Add `TEXTS.cppSdk` block (~50 lines documenting C++ API). Extend `TEXTS.outputFormat` — `"code"` field in JSON example. Add `"code": "..."` to both `es` and `en` formats. |
| `examples.js` | Add `code` string (the full `setup/loop` C++ code) to all 5 examples. |
| `ai.service.js` | New `syncFromCpp(code, boardId)` — builds system prompt "parse this C++ code → JSON config", calls DeepSeek. Falls back to regex parser: extract class instantiations, `if` conditions, `.on()/.off()` calls. |
| `ai.routes.js` | `POST /api/ai/sync { code, boardId }` → `{ config, diagnostics }` |
| `ai.schemas.js` | Add `code: Joi.string().optional()` |

**Regex fallback parser logic (deterministic):**
- `/(DHT22|BME280|Relay|PIR|...)\s+(\w+)\(([^)]+)\)/g` → extract driver + instance + pin args
- `/if\s*\((\w+)\.(\w+)\(\)\s*([<>=!]+)\s*([\d.]+)\)/g` → extract rules
- Match rule actions inside `if` blocks: `\.on\(\)` / `\.off\(\)` on relay instances

### Frontend

| File | Change |
|---|---|
| `AIChat.tsx` | Tabbed layout: Tab 1 = current chat, Tab 2 = Code editor. Lazy-load Monaco when Code tab is selected. |
| `CppEditor.tsx` (NEW) | Monaco Editor with C++ syntax. State: `code`, `parsed` (live regex diagnostics). |
| `DiagnosticsPanel.tsx` (NEW) | Renders parsed drivers, pins, conflicts, extracted rules. Collapsible sections. |
| `package.json` | Add `@monaco-editor/react` and `monaco-editor` |

---

## What Stays the Same

- **Firmware framework unchanged.** WiFi, MQTT, OTA, provisioning, state machine — all C, all untouched.
- **32 drivers unchanged.** `drv_dht22.c`, `drv_relay.c`, etc. remain pure C.
- **PlatformIO build unchanged.** `.cpp` auto-detected. No `platformio.ini` changes.
- **AI configure/apply flow unchanged.** POST /configure still returns JSON + now code. POST /apply still persists to DB.
- **Catalog API unchanged.** GET /api/ai/catalog still returns boards, sensors, actuators, displays.
- **Auth unchanged.** Sync endpoint uses same authGuard as configure/apply.

---

## Chained PR Strategy

**Estimated ~400-600 changed lines across 15-20 files.** Auto-forecast recommends 2 PRs:

### PR1: Core — C++ generation + Monaco editor + sync (≈250-350 lines)

1. **Firmware:** `iotech.hpp`, `user_app.cpp`, `main.c` extern bridge
2. **Backend:** C++ SDK section in prompt-builder, `code` field in output, examples with code, POST /sync endpoint, syncFromCpp service
3. **Frontend:** Monaco dependency, CppEditor component, tabbed layout in AIChat
4. **Tests:** Sync endpoint integration test, regex fallback unit test, prompt-builder output test with code field

### PR2: Enhancement — Live diagnostics + chat editing (≈150-250 lines)

1. **Frontend:** DiagnosticsPanel component, live regex parsing on code change, chat inline editing with diff preview
2. **Backend (optional):** Chat editing endpoint if not using configure
3. **Tests:** Diagnostics panel unit test (pin conflict detection, rule extraction)

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| DeepSeek generates invalid C++ syntax | Medium | Medium | Validate driver mentions against catalog. Regex fallback handles basic parsing. Schema validation catches malformed JSON. |
| Monaco bundle size (~2MB) | High (known) | Low | Lazy-load `@monaco-editor/react` only when Code tab is selected. Not loaded on initial page render. |
| `.cpp` breaks firmware build on some boards | Low | High | Test compile on all 4 environments (esp32dev, esp32s3, esp32c3, esp32cam). ESP-IDF toolchain has first-class C++ support since v4.0. |
| Regex parser misses edge cases | Medium | Medium | Regex is the fallback — LLM is primary. Diagnostics panel shows "⚠️ Could not parse" for unmatched patterns. User sees what regex detected. |
| Sync API call latency | Low | Medium | Live diagnostics are regex (instant, no API call). API sync happens only on explicit "Sync" button click. |
| I2C address conflicts not detected by regex | Low | Low | LLM sync catches these. Diagnostics panel shows pin occupancy from regex and flags GPIOS used by multiple drivers. |
| User confusion — two sources of truth (JSON + C++) | Medium | Medium | C++ is the single source of truth. JSON is hidden from UI. "Apply" button always parses current C++. |

---

## Alternatives Considered

### A. Embed an IDE (PlatformIO Web / Theia)
**Rejected.** Too heavy. Requires running toolchains in the browser/backend. 10x complexity for marginal benefit — the installer already has PlatformIO or Arduino IDE locally.

### B. Lua / MicroPython scripting engine
**Rejected.** The audience uses C++. Adding a scripting language doubles the maintenance surface and introduces runtime overhead on the ESP32.

### C. Only export a downloadable PlatformIO project (no web editor)
**Rejected.** Misses the "5-second trust verification" use case. The installer who just wants to confirm pin assignments should not have to download a zip, open VS Code, and scroll through files.

### D. C++ code but no bidirectional sync (read-only code display)
**Rejected.** If the user edits and can't sync back, the C++ diverges from the JSON silently. That's worse than showing nothing — it creates desync bugs.

### E. Replace JSON entirely with C++ as the only artifact
**Rejected prematurely.** JSON is still needed for the DB (templates, devices, rules). C++ alone doesn't serialize cleanly to relational tables. The JSON is an internal concern; C++ is the user-facing artifact.

---

## Success Criteria

1. **AI generates correct C++ code** for all 5 few-shot example configurations (DHT22 + relay, BME280 weather station, PIR + buzzer, HC-SR04 distance, ESP32-C3 variant).
2. **Monaco editor displays generated code** with C++ syntax highlighting. Lazy-loaded, no impact on initial page load TTI.
3. **User edits code and clicks "Sync"** → AI regenerates valid JSON config matching the edited code (drivers, pins, rules extracted correctly).
4. **Regex fallback works offline** — without DeepSeek, the regex parser extracts driver names, GPIO pins, and rule conditions from valid C++ code.
5. **Live diagnostics panel detects** driver declarations, pin assignments, and basic pin conflicts without API calls (pure client-side regex, < 50ms).
6. **Firmware compiles** on esp32dev, esp32s3, esp32c3, and esp32cam with `iotech.hpp` included and `user_app.cpp` linked.
7. **Existing flow unchanged** — POST /configure, POST /apply, and catalog all work as before, now with the additional `code` field in configure responses.
8. **PRs are reviewable** — each PR ≤ 400 changed lines, passes existing test suites, has its own tests.
9. **Bilingual support preserved** — code generation uses detected language for comments and variable names. C++ keywords remain English (language standard).

---

## Dependencies

- **@monaco-editor/react** (npm, MIT license) — new dependency, ~2MB gzipped but lazy-loaded
- **DeepSeek API** — existing dependency, already in use for /configure
- **ESP-IDF toolchain** — existing, supports `.cpp` natively (GCC 13.x, C++17)

---

## Rollback Plan

If the feature causes issues:
1. **Frontend:** Remove Code tab from AIChat. Remove `@monaco-editor/react`. Revert to single-column chat view. No DB changes needed.
2. **Backend:** Remove `/sync` route. Keep `/configure` returning JSON without `code` field (backward compatible — new field is optional in schema).
3. **Firmware:** Delete `iotech.hpp` and `user_app.cpp`. Revert `main.c` extern calls. `git revert` the PR merge.
