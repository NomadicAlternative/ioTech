/**
 * @file pal_rmt.h
 * @brief Platform Abstraction Layer — RMT (Remote Control) functions.
 *
 * Used by WS2812B and servo drivers. Implementation varies by target:
 * - ESP32: classic rmt_config() + rmt_write_items()
 * - ESP32-C3: newer rmt_new_tx_channel() + rmt_transmit()
 */
#pragma once

#include "esp_err.h"
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Initialize RMT TX channel for sending pulse trains.
 * @param channel        RMT channel number (0-7).
 * @param gpio           GPIO pin for RMT output.
 * @param resolution_hz  RMT tick resolution in Hz (e.g., 10 MHz = 100 ns ticks).
 * @param mem_blocks     Number of memory blocks (ESP32: mem_block_num; C3: mem_block_symbols).
 * @return ESP_OK on success.
 */
esp_err_t pal_rmt_init_tx(uint8_t channel, uint8_t gpio,
                           uint32_t resolution_hz, size_t mem_blocks);

/**
 * @brief Write RMT items (pulse train) to the TX channel.
 * @param channel  RMT channel number.
 * @param items    Array of RMT items (rmt_item32_t).
 * @param count    Number of items in the array.
 * @param wait     If true, block until all items are sent.
 * @return ESP_OK on success.
 */
esp_err_t pal_rmt_write_items(uint8_t channel, const void *items,
                               size_t count, bool wait);

/**
 * @brief Deinitialize and free an RMT TX channel.
 * @param channel  RMT channel number.
 * @return ESP_OK on success.
 */
esp_err_t pal_rmt_deinit_tx(uint8_t channel);

#ifdef __cplusplus
}
#endif
