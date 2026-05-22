/**
 * @file pal_gpio.h
 * @brief Platform Abstraction Layer — GPIO functions.
 *
 * Drivers use these instead of driver/gpio.h directly.
 * Mockable on host for unit testing.
 */
#pragma once

#include "esp_err.h"
#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/** GPIO direction enum (mirrors ESP-IDF GPIO_MODE_* for source compatibility) */
typedef enum {
    PAL_GPIO_INPUT  = 1,
    PAL_GPIO_OUTPUT = 2,
} pal_gpio_mode_t;

/**
 * @brief Configure a GPIO pin as input or output.
 * @param gpio  GPIO number (board-specific valid range).
 * @param mode  PAL_GPIO_INPUT or PAL_GPIO_OUTPUT.
 * @return ESP_OK or ESP_ERR_INVALID_ARG.
 */
esp_err_t pal_gpio_set_direction(uint8_t gpio, pal_gpio_mode_t mode);

/**
 * @brief Set output level (HIGH=1, LOW=0).
 * Pin must be configured as output first.
 * @return ESP_OK or ESP_ERR_INVALID_ARG.
 */
esp_err_t pal_gpio_set_level(uint8_t gpio, uint8_t level);

/**
 * @brief Read current GPIO level.
 * @param gpio   GPIO number to read.
 * @param level  OUT: 0 or 1 (pin level).
 * @return ESP_OK or ESP_ERR_INVALID_ARG.
 */
esp_err_t pal_gpio_get_level(uint8_t gpio, uint8_t *level);

#ifdef __cplusplus
}
#endif
