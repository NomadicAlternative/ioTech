/**
 * @file relay_controller.h
 * @brief GPIO relay controller — 7-channel, active LOW.
 *
 * Relay map:
 *   Relay 1 → GPIO 23
 *   Relay 2 → GPIO 22
 *   Relay 3 → GPIO 21
 *   Relay 4 → GPIO 19
 *   Relay 5 → GPIO 18
 *   Relay 6 → GPIO 5
 *   Relay 7 → GPIO 17
 */
#pragma once

#include "esp_err.h"
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

#define RELAY_COUNT 7

/**
 * @brief Initialize all relay GPIOs as outputs, set to OFF (HIGH).
 */
void relay_controller_init(void);

/**
 * @brief Set a relay state.
 *
 * @param relay_num  1-based relay number (1–7).
 * @param on         true = ON (LOW), false = OFF (HIGH).
 * @return ESP_OK, or ESP_ERR_INVALID_ARG if relay_num out of range.
 */
esp_err_t relay_set(uint8_t relay_num, bool on);

/**
 * @brief Get current relay state.
 *
 * @param relay_num  1-based relay number (1–7).
 * @return true if ON, false if OFF or invalid.
 */
bool relay_get(uint8_t relay_num);

#ifdef __cplusplus
}
#endif
