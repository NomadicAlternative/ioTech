#pragma once

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/** GPIO pin used for factory reset button (active LOW) */
#define FACTORY_RESET_GPIO_PIN   0   /* GPIO0 — BOOT button on most ESP32 devkits */

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
