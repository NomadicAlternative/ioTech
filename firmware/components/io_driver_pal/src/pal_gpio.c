/**
 * @file pal_gpio.c
 * @brief PAL GPIO — wraps ESP-IDF driver/gpio.h.
 */
#include "pal_gpio.h"
#include "driver/gpio.h"
#include "esp_log.h"

static const char *TAG = "pal_gpio";

esp_err_t pal_gpio_set_direction(uint8_t gpio, pal_gpio_mode_t mode)
{
    if (gpio > 48) {
        ESP_LOGE(TAG, "GPIO %u out of range (max 48)", gpio);
        return ESP_ERR_INVALID_ARG;
    }

    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << gpio),
        .mode         = (mode == PAL_GPIO_OUTPUT) ? GPIO_MODE_OUTPUT : GPIO_MODE_INPUT,
        .pull_up_en   = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type    = GPIO_INTR_DISABLE,
    };

    return gpio_config(&io_conf);
}

esp_err_t pal_gpio_set_level(uint8_t gpio, uint8_t level)
{
    if (gpio > 48) {
        ESP_LOGE(TAG, "GPIO %u out of range (max 48)", gpio);
        return ESP_ERR_INVALID_ARG;
    }
    return gpio_set_level(gpio, level ? 1 : 0);
}

esp_err_t pal_gpio_get_level(uint8_t gpio, uint8_t *level)
{
    if (gpio > 48 || level == NULL) {
        ESP_LOGE(TAG, "Invalid args: gpio=%u level=%p", gpio, (void *)level);
        return ESP_ERR_INVALID_ARG;
    }
    *level = (uint8_t)gpio_get_level(gpio);
    return ESP_OK;
}
