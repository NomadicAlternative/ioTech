/**
 * @file factory_reset.h
 * @brief Factory reset monitor — GPIO button hold detection.
 *
 * Monitors a configurable GPIO pin. When held LOW continuously for
 * FACTORY_RESET_HOLD_MS (5 seconds), sends SM_EVT_FACTORY_RESET to
 * the state machine. Short presses are ignored.
 *
 * GPIO pin is configurable via build flag:
 *   -DFACTORY_RESET_GPIO_PIN=14   (default — safe from DTR/RTS)
 *   -DFACTORY_RESET_GPIO_PIN=255  (disable factory reset)
 *
 * ⚠️ Do NOT use GPIO 0 (BOOT pin — conflicts with USB DTR/RTS).
 */
#pragma once

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/** GPIO pin used for factory reset button (active LOW).
 *  Default: GPIO 14 (safe from DTR/RTS). GPIO 0 is the BOOT pin. */
#ifndef FACTORY_RESET_GPIO_PIN
#define FACTORY_RESET_GPIO_PIN   14
#endif

/** Sentinel value to disable factory reset entirely */
#define FACTORY_RESET_GPIO_DISABLED  255

/** Duration (ms) the button must be held to trigger factory reset */
#define FACTORY_RESET_HOLD_MS    5000

/**
 * @brief Start the factory reset monitor task.
 *
 * Monitors FACTORY_RESET_GPIO_PIN. If held LOW continuously for
 * FACTORY_RESET_HOLD_MS (5 seconds), sends SM_EVT_FACTORY_RESET.
 * Short presses (< 5s) are ignored.
 */
void factory_reset_monitor_start(void);

/**
 * @brief Check if the button has been held for the required duration.
 *
 * This is a testable pure logic function used by the monitor task.
 *
 * @param pressed_ms  How long the button has been held (ms).
 * @param threshold_ms  Required hold time (ms).
 * @return true if pressed_ms >= threshold_ms, false otherwise.
 */
bool factory_reset_should_trigger(uint32_t pressed_ms, uint32_t threshold_ms);

#ifdef __cplusplus
}
#endif
