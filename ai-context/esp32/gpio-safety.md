# GPIO Safety System — ioTech

> **Purpose:** Prevent agents from assigning dangerous or unavailable GPIO pins. This file is the single source of truth for GPIO safety across all ESP32 variants.

---

## GPIO Classification

| Class | Meaning | Agent behavior |
|---|---|---|
| ✅ **SAFE** | General-purpose GPIO, no restrictions. | Use freely. |
| ⚠️ **WARNING** | Strapping pin or special function. Can be used IF installer confirms no conflict. | Warn before use. |
| 🚫 **FORBIDDEN** | Reserved (flash, input-only for outputs, nonexistent). | NEVER use. Reject automatically. |

---

## ESP32 (DevKit V1) — `-DBOARD_ESP32_DEVKIT`

### ✅ SAFE GPIOs
```
GPIO 4, 13, 14, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33
```

### ⚠️ WARNING GPIOs — Strapping, use with caution
```
GPIO 0   — Boot mode (pull LOW = bootloader). OK as input with pull-up.
GPIO 2   — Boot mode. OK with pull-up. On-board LED on some devkits.
GPIO 5   — Boot mode (SDIO slave). OK if not using SDIO.
GPIO 12  — MTDI strapping. Flash voltage selection. Avoid if possible.
GPIO 15  — MTDO strapping. JTAG debug output. OK for outputs with pull-down.
```

### 🚫 FORBIDDEN GPIOs
```
GPIO 6–11  — Internal flash (WROOM). Physically not broken out.
GPIO 34–39 — INPUT ONLY. No pull-ups, no pull-downs. Output = crash.
             Use only for sensors that don't need output control.
             GPIO 34 (HC-SR04 echo) — intentional, input-only is fine here.
```

### Special ioTech assignments
```
GPIO 32  → DHT22 DATA (safe)
GPIO 21  → I2C SDA (safe)
GPIO 22  → I2C SCL (safe)
GPIO 23  → Relay 1 (safe)
GPIO 25  → WS2812B (safe, RMT)
GPIO 26  → Servo (safe, LEDC)
GPIO 27  → PIR (safe)
GPIO 33  → HC-SR04 Trig (safe)
GPIO 34  → HC-SR04 Echo (input-only — safe because echo reads input)
GPIO 4   → DS18B20 1-Wire (safe)
GPIO 13  → Buzzer (safe, LEDC)
```

---

## ESP32-S3 — `-DBOARD_ESP32_S3`

### ✅ SAFE GPIOs
```
GPIO 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21
GPIO 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 47, 48
```

### ⚠️ WARNING GPIOs
```
GPIO 0   — Boot mode (pull LOW = bootloader).
GPIO 3   — JTAG. Can be used if JTAG not needed.
GPIO 46  — Strapping (log voltage). Avoid.
```

### 🚫 FORBIDDEN GPIOs
```
(None — S3 has no input-only pins and no flash pin conflicts on modules)
```
> ⚠️ Exception: GPIO 26–32 may be used for octal PSRAM on some modules. Verify.

### Special ioTech assignments
```
GPIO 4   → DHT22 DATA
GPIO 1   → I2C SDA
GPIO 2   → I2C SCL
GPIO 5   → Relay 1
GPIO 48  → WS2812B
GPIO 9   → Servo
GPIO 10  → PIR
GPIO 11  → HC-SR04 Trig
GPIO 12  → HC-SR04 Echo
GPIO 13  → DS18B20 1-Wire
GPIO 14  → Buzzer
```

---

## ESP32-C3 — `-DBOARD_ESP32_C3`

### ✅ SAFE GPIOs
```
GPIO 1, 3, 4, 5, 6, 7, 10, 18, 19, 20, 21
```

### ⚠️ WARNING GPIOs
```
GPIO 0   — Boot mode + DHT22. OK as DHT22 DATA (no output conflict).
GPIO 2   — Strapping. Avoid.
GPIO 8   — Strapping. Avoid.
GPIO 9   — Strapping. Avoid.
```

### 🚫 FORBIDDEN GPIOs
```
GPIO 11–17 — Not broken out on common modules.
UART_NUM_2 — Does not exist on C3 (only UART0+UART1). Use UART1.
```

### Special ioTech assignments
```
GPIO 0   → DHT22 DATA (⚠️ also boot pin — verify with pull-up)
GPIO 3   → I2C SDA
GPIO 4   → I2C SCL
GPIO 10  → Relay 1
GPIO 8   → WS2812B (⚠️ strapping pin — only if confirmed safe)
GPIO 9   → Servo (⚠️ strapping pin — only if confirmed safe)
GPIO 1   → PIR
GPIO 2   → HC-SR04 Trig (⚠️ strapping)
HC-SR04  → Echo via timer fallback (no RMT RX)
```

---

## ESP32-CAM (AI-Thinker) — `-DBOARD_ESP32_CAM`

### ✅ SAFE GPIOs (severely limited)
```
GPIO 1, 3, 4, 13, 14, 15, 16, 33
```

### ⚠️ WARNING GPIOs
```
GPIO 2   — On-board LED + strapping.
GPIO 12  — MTDI strapping.
```

### 🚫 FORBIDDEN
```
GPIO 0, 6–11, 17–32 — Camera, SD card, PSRAM, flash.
No servo, PIR, HC-SR04, DS18B20, WS2812B, buzzer.
Only DHT22 + I2C + relays (partial).
```

---

## Agent Rule: GPIO Validation Checklist

Before generating ANY firmware or config, agents MUST:

1. **Identify the target board** from installer input or board ID.
2. **Check each GPIO** against the SAFE/WARNING/FORBIDDEN list for that board.
3. **Map drivers to safe pins first** — never assign a forbidden pin.
4. **Flag warnings** — if a strapping pin is used, surface it to the installer.
5. **Check pin conflicts** — no two drivers on the same GPIO.
6. **Verify peripheral availability** — e.g., no WS2812B on C3 if RMT conflicts.

**Example:** Agent sees "ESP32, DHT22 on GPIO 14". GPIO 14 is SAFE on ESP32. ✅ Proceed.
**Example:** Agent sees "ESP32-C3, Modbus on UART2". UART2 doesn't exist on C3. 🚫 Reject, suggest UART1.
