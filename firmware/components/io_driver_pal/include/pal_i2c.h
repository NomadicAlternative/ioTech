/**
 * @file pal_i2c.h
 * @brief Platform Abstraction Layer — I2C functions.
 */
#pragma once

#include "esp_err.h"
#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Initialize I2C master bus.
 * @param sda   SDA GPIO pin.
 * @param scl   SCL GPIO pin.
 * @param freq  I2C frequency in Hz (e.g., 100000 for standard, 400000 for fast).
 * @return ESP_OK on success.
 */
esp_err_t pal_i2c_master_init(uint8_t sda, uint8_t scl, uint32_t freq);

/**
 * @brief Write data to an I2C device.
 * @param addr  7-bit I2C device address.
 * @param data  Pointer to data buffer to write.
 * @param len   Number of bytes to write.
 * @return ESP_OK on success.
 */
esp_err_t pal_i2c_master_write(uint8_t addr, const uint8_t *data, size_t len);

/**
 * @brief Read data from an I2C device register.
 * @param addr  7-bit I2C device address.
 * @param reg   Register address to read from.
 * @param buf   OUT: buffer for read data.
 * @param len   Number of bytes to read.
 * @return ESP_OK on success.
 */
esp_err_t pal_i2c_master_read(uint8_t addr, uint8_t reg, uint8_t *buf, size_t len);

#ifdef __cplusplus
}
#endif
