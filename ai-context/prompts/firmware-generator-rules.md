# Firmware Generator Rules — ioTech AI Agents

> **Purpose:** Injected into AI system prompts when generating C++ firmware code. Every agent that produces device firmware or configuration MUST follow these rules.

---

## Pre-Generation Validation (MANDATORY)

Before writing a single line of C++ or JSON, the agent MUST:

### 1. Identify the Board
```
✅ Correct:  "ESP32-S3 USB-C DevKit" → BOARD_ESP32_S3
✅ Correct:  "ESP32 DevKit V1"      → BOARD_ESP32_DEVKIT
✅ Correct:  "ESP32-C3 SuperMini"   → BOARD_ESP32_C3
❌ Wrong:    "Arduino board"        → Ask installer to specify ESP32 variant
```

### 2. Validate Every GPIO Against `gpio-safety.md`
```
For each GPIO the installer mentions or the agent plans to use:
- Is it SAFE, WARNING, or FORBIDDEN on this board?
- If WARNING: flag it to the installer with explanation.
- If FORBIDDEN: reject and suggest alternative.
```

### 3. Verify Driver-Board Compatibility
```
Check models.md driver compatibility matrix:
- PIR on ESP32-CAM? → ❌ Not available. Inform installer.
- Buzzer on ESP32-C3? → ❌ Not available. Inform installer.
- HC-SR04 on ESP32-C3? → ⚠️ Timer fallback only. Less precise. Warn.
```

### 4. Check Pin Conflicts
```
- No two drivers on the same GPIO.
- I2C SDA/SCL must match the board's I2C pins.
- Relays must use relay-designated GPIOs when available.
```

---

## Code Generation Rules

### Structure
```
1. Always start with: #include <iotech.hpp>
2. Declare ALL drivers at file scope (before setup())
3. setup() initializes all drivers (one begin() per driver)
4. loop() reads sensors, evaluates rules, writes actuators
5. NO delay() in user code unless using iotech delay (FreeRTOS-safe)
```

### Naming Conventions
```
✅ Good:  DHT22 dht(32);
✅ Good:  Relay riego(23, "Bomba de riego");
✅ Good:  BME280 bme(0x76);
✅ Good:  Buzzer alarma(13);
❌ Bad:   int pin32 = 32;  (don't use raw GPIO variables)
❌ Bad:   pinMode(32, OUTPUT);  (don't use Arduino APIs)
```

### Rule-to-Code Translation
| Installer says | Generated C++ |
|---|---|
| "activar relay 1 si temp > 30°C" | `if (temp >= 30.0) { relay1.on(); }` |
| "apagar relay 2 si humedad < 20%" | `if (hum < 20.0) { relay2.off(); }` |
| "buzzer si detecta movimiento" | `if (motion) { buzzer.beep(1000, 500); }` |
| "servo a 90° si presión > 1013" | `if (pres > 1013.0) { servo.setAngle(90); }` |

### I2C Device Handling
```
✅ Correct:  BME280 bme(0x76);  // default I2C address
✅ Correct:  SSD1306 display(0x3C);
✅ Correct:  LCD1602 lcd(0x27);
⚠️ Note:    SDA/SCL pins come from board config, not user code.
```

### What to NEVER Generate
```
❌ #include <Arduino.h>        — not Arduino, use iotech.hpp
❌ #include <WiFi.h>            — framework manages WiFi
❌ #include <PubSubClient.h>    — framework manages MQTT
❌ pinMode() / digitalWrite()   — not available
❌ WiFi.begin()                 — framework manages
❌ client.publish()             — framework publishes automatically
❌ while(true) { }              — blocks scheduler, watchdog kills
❌ delay(5000)                  — use iotech's non-blocking delay
```

---

## Output Quality Standards

### Production-Grade Code Only
```
✅ Modular, readable, well-structured
✅ Correct GPIO assignments for the specific board
✅ All drivers begin()'d before use
✅ Rule logic uses >= and <= (not strict > <) for thresholds
✅ Multi-sensor: all sensors read before any actuation
❌ Tutorial-style comments ("// This is a DHT22 sensor")
❌ Placeholder values ("// TODO: change GPIO")
❌ Unreachable code
```

### Bilingual Support
```
- Spanish installer → code comments + diagram in Spanish
- English installer → code comments + diagram in English
- C++ keywords and class names remain English
```

### Memory Awareness
```
- Each Relay object: ~12 bytes
- Each sensor object: ~8-16 bytes
- Total user code + objects < 2KB heap
- No dynamic allocation in loop() — declare at file scope
```

---

## Hardware Assumptions to Surface

When generating code, the agent MUST explicitly state (in the chat response) any assumptions:

```
✅ "Usando GPIO 32 para DHT22 (pin por defecto ESP32 DevKit)"
✅ "I2C en pines 21 (SDA) y 22 (SCL) — estándar ESP32"
⚠️ "GPIO 0 en C3 es también pin de boot — verificá que el DHT22 funcione"
🚫 "C3 no tiene UART2 — modbus requiere UART1"
```

---

## Integration with ioTech AI Pipeline

These rules are automatically included in:
1. **`prompt-builder.js`** → `cppSdk` section documents available classes.
2. **`ai-context/esp32/models.md`** → board capabilities and constraints.
3. **`ai-context/esp32/gpio-safety.md`** → SAFE/WARNING/FORBIDDEN pins.
4. **`ai-context/esp32/iotech-firmware-standard.md`** → architecture contract.

When an agent generates firmware, it should cross-reference all four sources.
