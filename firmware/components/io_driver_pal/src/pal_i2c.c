/**
 * @file pal_i2c.c
 * @brief PAL I2C — wraps ESP-IDF driver/i2c.h.
 */
#include "pal_i2c.h"
#include "driver/i2c.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

static const char *TAG = "pal_i2c";

#define I2C_MASTER_NUM      I2C_NUM_0
#define I2C_MASTER_TX_BUF   0  /* No TX buffer needed for master */
#define I2C_MASTER_RX_BUF   0  /* No RX buffer needed for master */

static bool s_initialized = false;
static SemaphoreHandle_t s_i2c_mutex = NULL;

esp_err_t pal_i2c_master_init(uint8_t sda, uint8_t scl, uint32_t freq)
{
    if (s_initialized) {
        ESP_LOGW(TAG, "I2C already initialized");
        return ESP_OK;
    }

    s_i2c_mutex = xSemaphoreCreateMutex();
    if (s_i2c_mutex == NULL) {
        ESP_LOGE(TAG, "Failed to create I2C mutex");
        return ESP_FAIL;
    }

    i2c_config_t conf = {
        .mode             = I2C_MODE_MASTER,
        .sda_io_num       = sda,
        .scl_io_num       = scl,
        .sda_pullup_en    = GPIO_PULLUP_ENABLE,
        .scl_pullup_en    = GPIO_PULLUP_ENABLE,
        .master.clk_speed = freq,
    };

    esp_err_t err = i2c_param_config(I2C_MASTER_NUM, &conf);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "i2c_param_config failed: %s", esp_err_to_name(err));
        vSemaphoreDelete(s_i2c_mutex);
        s_i2c_mutex = NULL;
        return err;
    }

    err = i2c_driver_install(I2C_MASTER_NUM, conf.mode,
                             I2C_MASTER_RX_BUF, I2C_MASTER_TX_BUF, 0);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "i2c_driver_install failed: %s", esp_err_to_name(err));
        vSemaphoreDelete(s_i2c_mutex);
        s_i2c_mutex = NULL;
        return err;
    }

    s_initialized = true;
    ESP_LOGI(TAG, "I2C master initialized: SDA=%u SCL=%u freq=%lu", sda, scl, freq);
    return ESP_OK;
}

esp_err_t pal_i2c_master_write(uint8_t addr, const uint8_t *data, size_t len)
{
    if (!s_i2c_mutex) return ESP_ERR_INVALID_STATE;

    xSemaphoreTake(s_i2c_mutex, pdMS_TO_TICKS(100));
    esp_err_t err = i2c_master_write_to_device(I2C_MASTER_NUM, addr,
                                                data, len,
                                                pdMS_TO_TICKS(100));
    xSemaphoreGive(s_i2c_mutex);
    return err;
}

esp_err_t pal_i2c_master_read(uint8_t addr, uint8_t reg, uint8_t *buf, size_t len)
{
    if (!s_i2c_mutex) return ESP_ERR_INVALID_STATE;

    xSemaphoreTake(s_i2c_mutex, pdMS_TO_TICKS(100));
    esp_err_t err = i2c_master_write_read_device(I2C_MASTER_NUM, addr,
                                                  &reg, 1,
                                                  buf, len,
                                                  pdMS_TO_TICKS(100));
    xSemaphoreGive(s_i2c_mutex);
    return err;
}
