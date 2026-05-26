# ESP32 Model Knowledge — ioTech

> **Purpose:** Give agents and the AI assistant authoritative knowledge about ESP32 variants so they make correct hardware decisions. Used by `prompt-builder.js` to enrich board context.

---

## Supported Models at a Glance

| Model | CPU | Cores | MHz | RAM | Flash | WiFi | BLE | USB | GPIO | ADC | RTC | ioTech |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **ESP32** | Xtensa LX6 | 2 | 240 | 520 KB | 4-16 MB | ✅ b/g/n | ✅ 4.2 | ❌ | 34 | 2×12-bit | ✅ | ✅ Supported |
| **ESP32-S2** | Xtensa LX7 | 1 | 240 | 320 KB | 4-16 MB | ✅ b/g/n | ❌ | ✅ OTG | 43 | 2×13-bit | ✅ | ❌ No BLE |
| **ESP32-S3** | Xtensa LX7 | 2 | 240 | 512 KB | 8-16 MB | ✅ b/g/n | ✅ 5.0 | ✅ OTG | 45 | 2×12-bit | ✅ | ✅ **Recommended** |
| **ESP32-C3** | RISC-V | 1 | 160 | 400 KB | 4 MB | ✅ b/g/n | ✅ 5.0 | ✅ JTAG | 22 | 2×12-bit | ✅ | ✅ Budget option |
| **ESP32-C6** | RISC-V | 1 | 160 | 512 KB | 8 MB | ✅ 6 (ax) | ✅ 5.3 | ✅ | 28 | 2×12-bit | ✅ | ⚠️ New, limited support |

---

## Detailed Per-Model Analysis

### ESP32 (Xtensa LX6 Dual-Core) — `BOARD_ESP32_DEVKIT`

- **Best for:** General purpose IoT, most tested, 32 drivers supported.
- **GPIO usable:** ~26 (avoid strapping + flash pins).
- **Strapping pins:** GPIO 0, 2, 5, 12, 15 — avoid for outputs.
- **Input-only pins:** GPIO 34, 35, 36, 39 — no pull-ups, no outputs.
- **Flash pins reserved:** GPIO 6–11 (internal flash on WROOM modules).
- **Limitations:** No native USB. UART bridge required. 2× I2C, 3× UART, 4× SPI.
- **LEDC resolution:** 16-bit (timer value `LEDC_TIMER_16_BIT`).
- **RMT:** Full TX + RX. HC-SR04 echo works natively.
- **ioTech status:** ✅ Primary platform. All 32 drivers tested.

### ESP32-S3 (Xtensa LX7 Dual-Core) — `BOARD_ESP32_S3`

- **Best for:** Production installs, AI/ML edge, future-proof.
- **GPIO usable:** ~36. Native USB-C ❤️. No USB-UART bridge needed.
- **Strapping pins:** GPIO 0, 46 — avoid for outputs.
- **No input-only pins** — all GPIOs can be used as outputs (unlike ESP32).
- **Flash pins:** No flash pins conflict on modules (external via SPI).
- **LEDC resolution:** 14-bit (`LEDC_TIMER_14_BIT`) — plan servo/led code accordingly.
- **RMT:** Full TX + RX.
- **ioTech status:** ✅ **Recommended for new installs.** USB-C provisioning + faster + more GPIO.

### ESP32-C3 (RISC-V Single-Core) — `BOARD_ESP32_C3`

- **Best for:** Cost-sensitive installs, simple sensor nodes.
- **GPIO usable:** ~16. Compact.
- **Strapping pins:** GPIO 2, 8, 9 — avoid.
- **UART limitation:** Only 2 UARTs (UART0 + UART1). No UART2. ⚠️ Drivers using UART_NUM_2 will fail.
- **RMT limitation:** No RMT RX. HC-SR04 echo must use timer fallback (less precise).
- **Missing drivers:** DS18B20 (1-wire) and Buzzer not available (GPIO0 conflicts).
- **LEDC resolution:** 14-bit.
- **ioTech status:** ✅ Supported but limited. Warn installer of constraints.

### ESP32-C6 (RISC-V Single-Core) — Not yet supported

- **Best for:** Future WiFi 6 + Thread/Zigbee installs.
- **ioTech status:** ❌ Not implemented. No board header, no driver testing.
- **Note for agents:** Do NOT generate code for C6 unless board is added to `io_board.h`.

### ESP32-S2 (Xtensa LX7 Single-Core) — Not supported

- **No BLE.** Cannot run ioTech provisioning (requires BLE for device setup).
- **ioTech status:** ❌ Permanently unsupported. Reject any S2 request.

---

## Board-to-Driver Compatibility Matrix

| Driver | ESP32 | S3 | C3 | CAM |
|---|---|---|---|---|
| DHT22 | ✅ GPIO32 | ✅ GPIO4 | ✅ GPIO0 | ✅ GPIO33 |
| BME280 | ✅ I2C | ✅ I2C | ✅ I2C | ✅ I2C |
| RELAY (8ch) | ✅ | ✅ | ✅ | ⚠️ 7ch max |
| PIR | ✅ GPIO27 | ✅ GPIO10 | ✅ GPIO1 | ❌ |
| HC-SR04 | ✅ GPIO33+34 | ✅ GPIO11+12 | ⚠️ timer fallback | ❌ |
| Buzzer | ✅ GPIO13 | ✅ GPIO14 | ❌ | ❌ |
| DS18B20 | ✅ GPIO4 | ✅ GPIO13 | ❌ | ❌ |
| WS2812B | ✅ GPIO25 | ✅ GPIO48 | ✅ GPIO8 | ❌ |
| SERVO | ✅ GPIO26 | ✅ GPIO9 | ✅ GPIO9 | ❌ |
| SSD1306 | ✅ I2C | ✅ I2C | ✅ I2C | ✅ I2C |
| LCD1602 | ✅ I2C | ✅ I2C | ✅ I2C | ✅ I2C |

---

## Design Decision: Why ESP32-S3 is the ioTech Standard

1. **USB-C native** — provisioning without CP2102 bridge. Installers love it.
2. **2× cores** — WiFi + user logic don't fight. More responsive.
3. **No input-only pins** — all GPIOs usable as outputs. Simpler for installers.
4. **BLE 5.0** — better provisioning range and speed.
5. **Pin count** — 36 usable GPIOs. Enough for complex multi-sensor installs.
6. **Precompiled drivers** — all 32 drivers compile on S3 (verified 2026-05-23).

**When to use ESP32 DevKit instead:** When the installer already owns DevKit V1 hardware.
**When to use ESP32-C3:** Ultra-low-cost single-sensor nodes.
**When to reject S2/C6:** Not implemented. Guide installer to S3 or C3.
