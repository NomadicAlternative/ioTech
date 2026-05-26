# cpp-code-editor Specification

## Purpose

Extend the ioTech AI assistant to generate C++ code alongside the existing JSON
configuration. Add a Monaco editor where installers read, verify, and edit
generated code. Enable bidirectional sync: editing C++ regenerates the JSON
config. Complement with live diagnostics and chat-based inline editing.

The C++ layer wraps the existing C `io_driver` vtable via `extern "C"`, producing
idiomatic Arduino-style code (`DHT22 dht(32); dht.readTemperature()`) that the
target audience expects.

---

## Requirements

### Requirement: C++ Code Generation from Natural Language

**ID:** SPEC-CCE-001
**Priority:** Must

The AI assistant MUST generate a valid C++ source snippet alongside the JSON
configuration when a user describes their device in natural language. The C++
code MUST use the `iotech.hpp` wrapper classes, reference only GPIO pins
declared in the selected board's pin map, and implement the described automation
rules as conditional logic in `setup()`/`loop()`.

#### Scenario: AI generates C++ for a DHT22 + relay configuration

**Given** the user sends "ESP32 con DHT22, cuando temperatura >= 30°C activar relay 1"
**And** the system prompt includes the C++ SDK section and board pin map
**When** the AI completes the configuration
**Then** the response MUST include a `code` field containing valid C++
**And** the code MUST instantiate `DHT22` with the correct GPIO pin from the board context
**And** the code MUST instantiate `Relay` with the correct GPIO and name
**And** the code MUST include a conditional block matching the described threshold
**And** relay actions MUST use `.on()` / `.off()` methods on the Relay instance

#### Scenario: AI generates C++ for a BME280 weather station

**Given** the user sends "BME280 con 2 relays: bomba si humedad < 30%, luz UV si presión > 1013"
**And** the BME280 driver is compatible with the selected board
**When** the AI completes the configuration
**Then** the generated code MUST use `BME280` class with default I2C address `0x76`
**And** the code MUST call `bme.readHumidity()` and `bme.readPressure()`
**And** the code MUST contain two independent `if` blocks in `loop()`
**And** relay instances MUST have descriptive names matching the user's intent

#### Scenario: AI generates C++ for a PIR motion alarm with buzzer

**Given** the user sends "PIR sensor que active un buzzer cuando detecte movimiento"
**When** the AI completes the configuration
**Then** the generated code MUST instantiate `PIR` and `Buzzer` classes
**And** the code MUST use `pir.motionDetected()` in the condition
**And** the code MUST call `buzzer.beep()` with a frequency parameter when motion is detected

#### Scenario: AI generates C++ for an HC-SR04 distance sensor

**Given** the user sends "HC-SR04 para medir nivel de agua, relay 1 si distancia > 50cm"
**And** the HC-SR04 driver is compatible with the board
**When** the AI completes the configuration
**Then** the generated code MUST instantiate `HC_SR04` with both trigger and echo GPIO pins
**And** the code MUST use `sr04.readDistance()` to obtain the measurement
**And** the code MUST compare distance in centimeters

#### Scenario: AI generates bilingual C++ output

**Given** the user sends a prompt in Spanish ("Tengo un ESP32 con DHT22...")
**When** the AI completes the configuration
**Then** the C++ code MUST use Spanish comments and Spanish variable names for semantic objects
**And** C++ language keywords (class, if, void, float, etc.) MUST remain in English
**And** relay names MUST match the detected language
**Given** the user sends a prompt in English ("I have an ESP32 with DHT22...")
**When** the AI completes the configuration
**Then** the C++ code MUST use English comments and English variable names for semantic objects

#### Scenario: Generated code follows the iotech.hpp API contract

**Given** the C++ SDK section in the system prompt documents the available classes and methods
**When** the AI generates C++ code
**Then** every class instantiation MUST match a documented class in `iotech.hpp`
**And** every method call MUST match a documented public method in that class
**And** the code MUST NOT reference non-existent classes, methods, or headers
**And** the code MUST include `#include <iotech.hpp>` if the SDK specifies it

#### Scenario: Generated code is structurally valid C++

**Given** the AI generates a `code` string
**When** the code is inspected
**Then** it MUST define either `void setup()` and `void loop()` or a single entry point
**And** all braces MUST be balanced
**And** all variable declarations MUST precede their first use in lexical scope
**And** mandatory includes MUST appear before any class instantiation

---

### Requirement: Bidirectional Sync — C++ Code to JSON Config

**ID:** SPEC-CCE-002
**Priority:** Must

The system MUST be able to parse user-edited C++ code and regenerate the
corresponding JSON configuration (drivers, datastreams, rules, diagram). The
parsing MUST work via the primary LLM path (DeepSeek) and degrade gracefully to
a deterministic regex fallback when the LLM is unavailable.

#### Scenario: LLM-based sync extracts full config from valid C++

**Given** the user has edited valid C++ code in the Monaco editor
**And** the code contains `DHT22 dht(32)`, `Relay riego(23, "Bomba")`, and an `if` block
**When** the user clicks "Sync"
**And** the DeepSeek API is available
**Then** a `POST /api/ai/sync` request MUST be sent with the code and board ID
**And** the response MUST include a complete `config` object with drivers, datastreams, rules, and diagrama
**And** each driver in the config MUST correspond to a class instantiation in the code
**And** each relay channel MUST match the GPIO pin and name from the `Relay` constructor
**And** each rule MUST match an `if` block with a comparison against a sensor method
**And** the diagrama MUST trace the physical connections implied by the GPIO pins

#### Scenario: Regex fallback extracts drivers and pins when LLM is unavailable

**Given** DeepSeek API is unavailable or returns an error
**And** the user clicks "Sync" on C++ code containing `DHT22 dht(32)` and `Relay riego(23, "Bomba")`
**When** the sync endpoint processes the request
**Then** the regex fallback parser MUST extract `DHT22` with GPIO 32
**And** the regex fallback MUST extract `Relay` channel 1 with GPIO 23 and name "Bomba"
**And** the regex fallback MUST extract `if` conditions matching `instance.method() operator value`
**And** the response MUST include `_fallback: true` to indicate the deterministic path
**And** the response MUST include `_diagnostics.warnings` for any patterns that could not be parsed

#### Scenario: Sync preserves code that was not changed

**Given** the user edits only the relay GPIO pin from 23 to 19
**And** leaves all other code unchanged
**When** the user clicks "Sync"
**Then** all other drivers, datastreams, and rules MUST remain unchanged in the regenerated config
**And** only the relay pin attribute MUST be updated to 19

#### Scenario: Sync detects pin conflicts

**Given** the user edits C++ code where two drivers use the same GPIO pin
**When** the user clicks "Sync"
**Then** the response MUST include a `diagnostics.conflicts` array
**And** each conflict MUST specify which GPIO is shared and which drivers are involved
**And** the sync MUST still return a config (warn, don't block)

#### Scenario: Sync rejects unparseable code

**Given** the user edits C++ code with syntax errors (unmatched braces, missing semicolons)
**When** the user clicks "Sync"
**Then** the system MUST return a 422 status with an error message
**And** the error message MUST describe which part of the code could not be parsed
**And** the user's code MUST NOT be overwritten

#### Scenario: Sync endpoint requires authentication

**Given** an unauthenticated request to `POST /api/ai/sync`
**When** the request is processed
**Then** the server MUST return 401 Unauthorized
**And** no parsing MUST occur

---

### Requirement: Monaco Editor Integration

**ID:** SPEC-CCE-003
**Priority:** Must

The frontend MUST provide a Monaco Editor tab where the AI-generated C++ code
is displayed with syntax highlighting. The editor MUST be lazy-loaded when the
user switches to the Code tab. The user MUST be able to freely edit the code.

#### Scenario: Monaco editor displays generated code with C++ syntax highlighting

**Given** the AI has generated a response containing C++ code
**And** the user switches to the Code tab
**When** the Monaco editor loads
**Then** it MUST display the generated C++ code
**And** C++ keywords MUST be highlighted (class, void, float, if, else, return)
**And** string literals MUST be highlighted
**And** numeric constants MUST be highlighted
**And** comments MUST be distinguished from code

#### Scenario: Monaco editor lazy-loads on tab switch

**Given** the user is viewing the Chat tab
**When** the page loads
**Then** the Monaco editor bundle MUST NOT be downloaded
**And** the initial page load TTI MUST be unaffected by Monaco's presence
**Given** the user clicks the Code tab
**When** the tab becomes active
**Then** the Monaco bundle MUST load at that moment
**And** a loading indicator MUST be shown during the download

#### Scenario: User edits code freely in Monaco

**Given** C++ code is displayed in the Monaco editor
**When** the user types, deletes, or pastes text
**Then** the editor content MUST update immediately
**And** standard keyboard shortcuts MUST work (Ctrl+Z undo, Ctrl+C copy, Ctrl+V paste)
**And** the cursor position MUST be preserved during edits

#### Scenario: Code tab shows a diff state indicator

**Given** the AI has generated C++ code
**And** the user edits the code in Monaco
**When** the code content diverges from the last generated version
**Then** a visual indicator MUST show that the code has unsaved modifications
**And** the indicator MUST clear after a successful Sync

#### Scenario: Monaco editor preserves code on tab switches

**Given** the user edits C++ code in the Code tab
**When** the user switches to the Chat tab and back to the Code tab
**Then** the editor MUST display the user's edited code, not the original generated code
**And** the unsaved modification indicator MUST remain if no Sync was performed

---

### Requirement: Live Diagnostics Panel

**ID:** SPEC-CCE-004
**Priority:** Should

The frontend MUST provide a live diagnostics panel alongside the Monaco editor
that parses the C++ code in real time via client-side regex and displays
detected drivers, pin assignments, pin conflicts, and extracted rules. The
parsing MUST complete in under 50ms and MUST NOT require any API call.

#### Scenario: Diagnostics panel detects driver declarations

**Given** the C++ code contains `DHT22 dht(32)` and `BME280 bme(0x76)`
**When** the diagnostics panel parses the code
**Then** it MUST list "DHT22" with GPIO 32 under detected drivers
**And** it MUST list "BME280" with I2C address 0x76 under detected drivers
**And** each driver entry MUST show the instance variable name

#### Scenario: Diagnostics panel detects relay channels

**Given** the C++ code contains `Relay riego(23, "Bomba de riego")`
**When** the diagnostics panel parses the code
**Then** it MUST list "Relay" with channel "Bomba de riego" on GPIO 23
**And** it MUST show the relay name as presented in the code

#### Scenario: Diagnostics panel flags GPIO pin conflicts

**Given** the C++ code contains `DHT22 dht(21)` and `BME280 bme(0x76)`
**And** the board context assigns I2C SDA to GPIO 21
**When** the diagnostics panel parses the code and cross-references the board pin map
**Then** it MUST flag GPIO 21 as conflicting between DHT22 data and I2C SDA
**And** the conflict MUST be visually highlighted (e.g., warning icon, amber color)

#### Scenario: Diagnostics panel flags unavailable pins

**Given** the C++ code assigns a driver to GPIO 34 on an ESP32 where GPIO 34-39 are input-only
**And** the driver is a relay (which requires output capability)
**When** the diagnostics panel parses the code
**Then** it MUST flag GPIO 34 as unsuitable for output
**And** the warning MUST explain the constraint (input-only pin)

#### Scenario: Diagnostics panel extracts rule conditions

**Given** the C++ code contains `if (dht.readTemperature() > 35.0) { ventilador.on(); }`
**When** the diagnostics panel parses the code
**Then** it MUST extract a rule with condition "temperature > 35"
**And** it MUST show the associated action "ventilador → ON"
**And** the rule MUST reference the correct datastream key ("temperature")

#### Scenario: Diagnostics panel handles unparseable code gracefully

**Given** the C++ code contains syntax that the regex cannot match
**When** the diagnostics panel attempts to parse
**Then** the unparseable section MUST show a "⚠️ Could not parse" indicator
**And** the rest of the panel MUST continue displaying successfully parsed sections
**And** partial results MUST be shown (detected drivers even if no rules extracted)

#### Scenario: Diagnostics update on every keystroke under 50ms

**Given** the user is actively typing in the Monaco editor
**When** any keystroke changes the code
**Then** the diagnostics panel MUST re-parse within 50ms
**And** the re-parse MUST NOT block the editor's responsiveness
**And** the diagnostics MUST be debounced if necessary to maintain the performance budget

#### Scenario: Diagnostics panel is collapsible

**Given** the diagnostics panel is visible
**When** the user clicks a collapse toggle on a section (Drivers, Pins, Rules)
**Then** that section MUST collapse or expand
**And** the collapse state MUST be preserved across re-parses
**And** each section MUST show an item count badge when collapsed

---

### Requirement: Chat-Based Inline Editing

**ID:** SPEC-CCE-005
**Priority:** Could

The user MUST be able to send natural language instructions while viewing C++
code, and the AI MUST return a diff against the current code. The user can
approve the diff to apply changes or reject it to keep the original code.

#### Scenario: AI generates a diff from a natural language instruction

**Given** the user is viewing C++ code in the Code tab
**And** the current code contains `Relay riego(23, "Bomba")`
**When** the user types "cambia el relay 1 al GPIO 19" in the chat input
**And** the instruction is sent to the AI
**Then** the AI MUST respond with a diff showing only the changed lines
**And** the diff MUST show `-Relay riego(23, "Bomba")` and `+Relay riego(19, "Bomba")`
**And** unchanged lines MUST NOT appear in the diff
**And** the diff MUST be visually rendered with red/green highlighting

#### Scenario: User approves a diff to apply changes

**Given** the AI has returned a diff in response to a chat instruction
**When** the user clicks "Apply" on the diff
**Then** the Monaco editor content MUST be updated with the diff applied
**And** the diagnostics panel MUST re-parse the updated code
**And** a confirmation MUST be shown briefly

#### Scenario: User rejects a diff

**Given** the AI has returned a diff
**When** the user clicks "Reject" on the diff
**Then** the Monaco editor content MUST remain unchanged
**And** the diff preview MUST be dismissed
**And** the chat instruction MUST be cleared

#### Scenario: Chat editing handles multiple simultaneous changes

**Given** the user sends "agregale un buzzer en GPIO 13 que suene a 40°C"
**When** the AI processes the instruction against the current code
**Then** the diff MUST show new lines for the Buzzer instantiation
**And** the diff MUST show a new `if` block or modification to an existing one
**And** both changes MUST appear in a single diff

#### Scenario: Chat editing preserves user comments

**Given** the C++ code contains a user-written comment `// Pin cambiado manualmente`
**And** the user sends a chat instruction that modifies nearby code
**When** the AI returns the diff
**Then** the diff MUST NOT remove the user's comment
**And** the comment MUST be preserved in its original position or moved coherently

#### Scenario: Chat editing fails gracefully on ambiguous instructions

**Given** the user sends "cambia el pin" (ambiguous — which driver?)
**When** the AI processes the instruction
**Then** the system MUST respond with a clarification question instead of a diff
**And** the question MUST ask the user to specify which driver and to which pin

---

### Requirement: Backward Compatibility

**ID:** SPEC-CCE-006
**Priority:** Must

All existing AI assistant endpoints (`POST /api/ai/configure`, `POST
/api/ai/apply`, `GET /api/ai/catalog`) MUST continue to work without
modification to their request/response contracts. The new `code` field in
configure responses MUST be optional in the schema so existing consumers are
unaffected.

#### Scenario: POST /configure returns code field alongside existing JSON

**Given** the AI assistant is working
**When** a `POST /api/ai/configure` request is sent with a valid prompt
**Then** the response MUST include all existing fields (template, drivers, datastreams, rules, diagrama)
**And** a new `code` field MUST be present containing the C++ code
**And** the `code` field MUST be a non-empty string
**And** all existing field types and structures MUST be unchanged

#### Scenario: POST /apply works with or without code field

**Given** a valid JSON config object
**When** the config contains the new `code` field in a `POST /api/ai/apply` request
**Then** the application MUST succeed and ignore the `code` field for DB persistence
**Given** a valid JSON config object without the `code` field
**When** a `POST /api/ai/apply` request is sent
**Then** the application MUST succeed as before
**And** no validation error MUST be raised for the missing `code` field

#### Scenario: GET /catalog remains unchanged

**Given** the catalog endpoint is called
**When** the response is returned
**Then** it MUST contain the same structure as before (boards, connectivity, sensors, actuators, displays)
**And** no code-related fields MUST appear in catalog responses

#### Scenario: Existing _source field behavior is preserved

**Given** the LLM is available and generates a valid config
**When** `POST /api/ai/configure` is called
**Then** the response MUST include `_source: "ai"` (unchanged)
**Given** the LLM is unavailable and fallback is used
**When** the configure endpoint is called
**Then** the response MUST include `_source: "rule-based-fallback"` (unchanged)

#### Scenario: Schema validation allows code field

**Given** the `ai.schemas.js` validation function
**When** a config object with an additional `code` string field is validated
**Then** the validation MUST succeed
**And** the `code` field MUST be optional (config without it also validates)
**And** `stripUnknown: true` behavior MUST NOT remove the `code` field

---

### Requirement: Firmware C++ Wrapper Layer

**ID:** SPEC-CCE-007
**Priority:** Must

The firmware MUST ship a header-only C++ wrapper (`iotech.hpp`) that exposes
each supported driver as a class with an idiomatic Arduino-style API. Each
method MUST delegate to the existing C `io_driver` vtable via `extern "C"`. The
wrapper layer MUST NOT modify any existing C driver code.

#### Scenario: iotech.hpp wraps DHT22 with begin/readTemperature/readHumidity

**Given** `iotech.hpp` is included in a `.cpp` file
**And** the DHT22 C driver is registered in the io_driver linker section
**When** user code calls `DHT22 dht(32); dht.begin();` then `dht.readTemperature()`
**Then** `begin()` MUST call `io_driver_load("DHT22", &cfg)` with gpio=32
**And** `readTemperature()` MUST call `io_driver_read("DHT22", ...)` and return the temperature value
**And** `readHumidity()` MUST call `io_driver_read("DHT22", ...)` and return the humidity value
**And** the C driver's `drv_dht22.c` MUST NOT be modified

#### Scenario: iotech.hpp wraps Relay with on/off/state

**Given** user code calls `Relay r(23, "Bomba"); r.on();`
**When** the relay wrapper executes
**Then** `on()` MUST call `io_driver_command("RELAY", ...)` with action "relay" and state "on"
**And** `off()` MUST call the same with state "off"
**And** `state()` MUST return the last known state from the C driver's read response

#### Scenario: iotech.hpp wraps BME280 with begin and typed sensor reads

**Given** user code calls `BME280 bme(0x76); bme.begin();` then `bme.readPressure()`
**When** the BME280 wrapper executes
**Then** `begin()` MUST call `io_driver_load("BME280", &cfg)` with i2c_addr=0x76
**And** `readPressure()` MUST call `io_driver_read("BME280", ...)` and extract the "pressure" key
**And** the I2C SDA/SCL pins MUST be resolved from the board context, not hardcoded

#### Scenario: iotech.hpp compiles on all supported boards

**Given** the `iotech.hpp` header
**When** it is compiled in an ESP-IDF project targeting esp32dev, esp32s3, esp32c3, or esp32cam
**Then** compilation MUST succeed with zero errors
**And** compilation MUST succeed with zero warnings at `-Wall -Wextra`
**And** no STL headers MUST be included (no `<vector>`, `<string>`, `<memory>`)
**And** the header MUST be includable from both `.cpp` and `.ino` files

#### Scenario: user_app.cpp is compiled and linked alongside main.c

**Given** `user_app.cpp` contains `void setup()` and `void loop()` definitions
**And** `main.c` calls `extern "C" void user_setup()` and `extern "C" void user_loop()`
**When** the firmware is compiled with PlatformIO
**Then** the `.cpp` file MUST be auto-detected and compiled by the build system
**And** the linker MUST resolve all symbols between C and C++ translation units
**And** no duplicate symbol errors MUST occur

#### Scenario: Wrapper methods return DRV_ERR_* as appropriate

**Given** a driver is not loaded before reading (e.g., `begin()` was never called)
**When** a wrapper method like `readTemperature()` is called
**Then** it MUST return a sentinel value (NaN for float reads, empty for strings)
**And** it MUST NOT crash or cause undefined behavior
**And** if a status mechanism exists, it MUST indicate the error state

---

## Dependencies

- `@monaco-editor/react` (npm, MIT) — new frontend dependency, lazy-loaded
- DeepSeek API — existing, used by `/configure` and new `/sync`
- `io_driver_types.h` — existing C header, already has `extern "C"` guards
- ESP-IDF toolchain (GCC 13.x, C++17) — existing, `.cpp` supported natively

## Related Specs

- AI Configuration (`ai.schemas.js`) — extended with optional `code` field
- Device Templates (`device-templates`) — unchanged but datastreams must match parsed C++

## Non-Functional Requirements

- Monaco lazy-load MUST NOT increase initial page TTI by more than 50ms
- Live diagnostics re-parse MUST complete in under 50ms per keystroke (debounced)
- `POST /api/ai/sync` MUST respond in under 5 seconds (LLM path) or 200ms (regex fallback)
- `iotech.hpp` MUST add less than 2KB to the firmware binary when compiled
- All UI text MUST be bilingual (es/en), detected from user language preference
