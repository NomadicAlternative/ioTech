/**
 * @file io_driver_nvs.c
 * @brief io_driver NVS config loader — reads driver config from "iotech" namespace.
 */
#include "io_driver.h"
#include "io_board.h"

#include "nvs.h"
#include "nvs_flash.h"
#include "esp_log.h"
#include <string.h>
#include <stdio.h>

static const char *TAG = "io_driver_nvs";
static const char *NVS_NS = "iotech";

drv_err_t io_driver_load_all_from_nvs(void)
{
    nvs_handle_t h;
    if (nvs_open(NVS_NS, NVS_READONLY, &h) != ESP_OK) {
        /* No driver config in NVS — that's OK; device may not have any drivers. */
        ESP_LOGI(TAG, "No driver config in NVS (namespace '%s' not found)", NVS_NS);
        return DRV_OK;
    }

    uint8_t drv_count = 0;
    esp_err_t err = nvs_get_u8(h, "drv_count", &drv_count);
    if (err != ESP_OK || drv_count == 0) {
        nvs_close(h);
        ESP_LOGI(TAG, "drv_count=%u — no drivers to load", drv_count);
        return DRV_OK;
    }

    const board_pinmap_t *pinmap = io_board_get_pinmap();
    if (pinmap == NULL) {
        nvs_close(h);
        ESP_LOGE(TAG, "Board pinmap not initialized");
        return DRV_ERR_INTERNAL;
    }

    for (uint8_t i = 0; i < drv_count && i < IO_DRIVER_MAX_ACTIVE; i++) {
        char name_key[16], gpio_key[16], gpio2_key[16], i2c_key[16], chan_key[16];
        snprintf(name_key, sizeof(name_key), "drv_%u_name", i);
        snprintf(gpio_key, sizeof(gpio_key), "drv_%u_gpio", i);
        snprintf(gpio2_key, sizeof(gpio2_key), "drv_%u_gpio2", i);
        snprintf(i2c_key, sizeof(i2c_key), "drv_%u_i2c", i);
        snprintf(chan_key, sizeof(chan_key), "drv_%u_chan", i);

        char drv_name[17] = {0};
        size_t name_len = sizeof(drv_name);
        if (nvs_get_str(h, name_key, drv_name, &name_len) != ESP_OK) {
            ESP_LOGW(TAG, "Missing driver name key '%s', skipping", name_key);
            continue;
        }

        driver_config_t cfg;
        memset(&cfg, 0, sizeof(cfg));
        cfg.gpio   = DRV_GPIO_NONE;
        cfg.gpio2  = DRV_GPIO_NONE;
        cfg.custom = NULL;

        nvs_get_u8(h, gpio_key,  &cfg.gpio);
        nvs_get_u8(h, gpio2_key, &cfg.gpio2);
        nvs_get_u16(h, i2c_key,  &cfg.i2c_addr);
        nvs_get_u8(h, chan_key,  &cfg.channels);

        /* Resolve board pins */
        cfg.i2c_sda = pinmap->i2c_sda;
        cfg.i2c_scl = pinmap->i2c_scl;

        drv_err_t load_err = io_driver_load(drv_name, &cfg);
        if (load_err != DRV_OK) {
            ESP_LOGW(TAG, "Failed to load driver '%s': %s", drv_name, drv_err_str(load_err));
        }
    }

    nvs_close(h);
    ESP_LOGI(TAG, "Loaded %u drivers from NVS", io_driver_active_count());
    return DRV_OK;
}
