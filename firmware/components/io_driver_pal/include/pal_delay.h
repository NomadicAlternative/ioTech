/**
 * @file pal_delay.h
 * @brief Platform Abstraction Layer — delay functions.
 */
#pragma once

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Busy-wait delay in microseconds.
 * Uses ROM-resident esp_rom_delay_us on ESP32 targets (cache-immune).
 * @param us  Microseconds to delay.
 */
void pal_delay_us(uint32_t us);

/**
 * @brief Non-blocking delay in milliseconds.
 * Yields to FreeRTOS scheduler via vTaskDelay.
 * @param ms  Milliseconds to delay.
 */
void pal_delay_ms(uint32_t ms);

#ifdef __cplusplus
}
#endif
