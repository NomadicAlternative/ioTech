/**
 * @file pal_timer.h
 * @brief Platform Abstraction Layer — high-resolution timer functions.
 *
 * Used by HC-SR04 echo timing on ESP32-C3 (where RMT RX is not available).
 */
#pragma once

#include "esp_err.h"
#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/** Timer callback type. */
typedef void (*pal_timer_cb_t)(void *arg);

/**
 * @brief Start a one-shot microsecond-resolution timer.
 * Uses esp_timer internally. Callback runs from esp_timer task.
 * @param period_us  Timer period in microseconds.
 * @param cb         Callback function.
 * @param arg        Argument passed to callback.
 * @return ESP_OK on success.
 */
esp_err_t pal_timer_start_us(uint64_t period_us, pal_timer_cb_t cb, void *arg);

/**
 * @brief Get current time in microseconds.
 * Wraps esp_timer_get_time() on hardware.
 * @return Current time in microseconds since boot.
 */
uint64_t pal_timer_get_us(void);

/**
 * @brief Cancel a running timer.
 * @return ESP_OK on success.
 */
esp_err_t pal_timer_stop(void);

#ifdef __cplusplus
}
#endif
