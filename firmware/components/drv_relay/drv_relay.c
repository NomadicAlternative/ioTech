/**
 * @file drv_relay.c
 * @brief RELAY actuator driver — 1-8 channels, active-LOW.
 *
 * Commands are received as cJSON via the engine's dispatch:
 *   { "relay": N, "state": "on"|"off" }
 */
#include "drv_relay.h"
#include "io_board.h"
#include "pal_gpio.h"

#include "cJSON.h"
#include "esp_log.h"
#include <string.h>
#include <stdio.h>

static const char *TAG = "drv_relay";

/* ── Driver state ──────────────────────────────────────────────────── */

#define RELAY_MAX_CHANNELS 8

static uint8_t s_gpios[RELAY_MAX_CHANNELS];
static uint8_t s_num_channels = 0;
static bool    s_shadow[RELAY_MAX_CHANNELS];
static bool    s_ready = false;

/* ── Vtable implementation ─────────────────────────────────────────── */

static drv_err_t relay_init(const driver_config_t *cfg)
{
    if (cfg == NULL) return DRV_ERR_ARG;

    uint8_t channels = cfg->channels;
    if (channels == 0 || channels > RELAY_MAX_CHANNELS) {
        ESP_LOGE(TAG, "Invalid channel count: %u (must be 1-%d)", channels, RELAY_MAX_CHANNELS);
        return DRV_ERR_ARG;
    }

    if (channels == 1) {
        /* Per-instance mode (multi-instance via DRV_FLAG_MULTI_INSTANCE):
           use cfg->gpio directly. One channel = relay 1 always. */
        uint8_t gpio = cfg->gpio;
        if (gpio == DRV_GPIO_NONE) {
            ESP_LOGE(TAG, "GPIO not configured for single-channel relay");
            return DRV_ERR_ARG;
        }

        s_gpios[0] = gpio;
        s_num_channels = 1;

        esp_err_t err = pal_gpio_set_direction(gpio, PAL_GPIO_OUTPUT);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "pal_gpio_set_direction failed for GPIO %u: %d", gpio, (int)err);
            return DRV_ERR_INTERNAL;
        }
        pal_gpio_set_level(gpio, 1); /* HIGH = OFF (active-LOW) */
        s_shadow[0] = false;

        s_ready = true;
        ESP_LOGI(TAG, "RELAY initialized: single channel GPIO %u", gpio);
        return DRV_OK;
    }

    /* Multi-channel mode (legacy): read from board pinmap */
    const board_pinmap_t *pinmap = io_board_get_pinmap();
    if (pinmap == NULL) {
        ESP_LOGE(TAG, "Board pinmap not initialized");
        return DRV_ERR_INTERNAL;
    }

    s_num_channels = channels;

    for (uint8_t ch = 0; ch < channels; ch++) {
        uint8_t gpio = pinmap->relay_gpios[ch];
        if (gpio == DRV_GPIO_NONE) {
            ESP_LOGW(TAG, "Channel %u has no GPIO (DRV_GPIO_NONE), skipping", ch + 1);
            s_gpios[ch] = DRV_GPIO_NONE;
            s_shadow[ch] = false;
            continue;
        }

        s_gpios[ch] = gpio;

        /* Configure as output; start HIGH = OFF (active-LOW) */
        esp_err_t err = pal_gpio_set_direction(gpio, PAL_GPIO_OUTPUT);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "pal_gpio_set_direction failed for GPIO %u: %d", gpio, (int)err);
            return DRV_ERR_INTERNAL;
        }

        pal_gpio_set_level(gpio, 1); /* HIGH = OFF */
        s_shadow[ch] = false;
    }

    s_ready = true;
    ESP_LOGI(TAG, "RELAY initialized: %u channels", channels);
    return DRV_OK;
}

static drv_err_t relay_read(driver_value_t *values, uint8_t *count)
{
    if (!s_ready) return DRV_ERR_STATE;
    if (values == NULL || count == NULL) return DRV_ERR_ARG;

    *count = 0;

    for (uint8_t ch = 0; ch < s_num_channels && *count < DRV_MAX_VALUES; ch++) {
        if (s_gpios[ch] == DRV_GPIO_NONE) continue;

        snprintf(values[*count].key, sizeof(values[*count].key), "relay%u", ch + 1);
        values[*count].type = DRV_VAL_BOOL;
        values[*count].bool_value = s_shadow[ch];
        (*count)++;
    }

    return DRV_OK;
}

static drv_err_t relay_command(const char *action, const void *arg)
{
    if (!s_ready) return DRV_ERR_STATE;
    if (action == NULL || arg == NULL) return DRV_ERR_ARG;

    /* Only respond to "relay" action (case-insensitive via engine) */
    const cJSON *root = (const cJSON *)arg;

    cJSON *j_relay = cJSON_GetObjectItem(root, "relay");
    cJSON *j_state = cJSON_GetObjectItem(root, "state");

    if (!cJSON_IsNumber(j_relay) || !cJSON_IsString(j_state)) {
        ESP_LOGE(TAG, "Invalid command format (expected {relay:N, state:\"on\"|\"off\"})");
        return DRV_ERR_ARG;
    }

    uint8_t relay_num = (uint8_t)j_relay->valueint;
    if (relay_num < 1 || relay_num > s_num_channels) {
        ESP_LOGE(TAG, "Invalid relay number: %u (valid: 1-%u)", relay_num, s_num_channels);
        return DRV_ERR_ARG;
    }

    uint8_t ch = relay_num - 1;
    if (s_gpios[ch] == DRV_GPIO_NONE) {
        ESP_LOGW(TAG, "Relay %u has no GPIO assigned", relay_num);
        return DRV_ERR_ARG;
    }

    const char *state_str = j_state->valuestring;
    if (strcmp(state_str, "on") == 0) {
        /* Active-LOW: ON = 0 */
        pal_gpio_set_level(s_gpios[ch], 0);
        s_shadow[ch] = true;
        ESP_LOGI(TAG, "Relay %u ON (GPIO %u → LOW)", relay_num, s_gpios[ch]);
    } else if (strcmp(state_str, "off") == 0) {
        /* OFF = 1 */
        pal_gpio_set_level(s_gpios[ch], 1);
        s_shadow[ch] = false;
        ESP_LOGI(TAG, "Relay %u OFF (GPIO %u → HIGH)", relay_num, s_gpios[ch]);
    } else {
        ESP_LOGE(TAG, "Invalid state: '%s' (expected 'on' or 'off')", state_str);
        return DRV_ERR_ARG;
    }

    return DRV_OK;
}

static drv_err_t relay_deinit(void)
{
    /* Set all GPIOs to input (safe state) */
    for (uint8_t ch = 0; ch < s_num_channels; ch++) {
        if (s_gpios[ch] != DRV_GPIO_NONE) {
            pal_gpio_set_direction(s_gpios[ch], PAL_GPIO_INPUT);
        }
    }
    memset(s_gpios, 0xFF, sizeof(s_gpios));
    memset(s_shadow, 0, sizeof(s_shadow));
    s_num_channels = 0;
    s_ready = false;
    return DRV_OK;
}

/* ── Vtable ────────────────────────────────────────────────────────── */

const driver_t drv_relay = {
    .name    = "RELAY",
    .flags   = DRV_FLAG_MULTI_INSTANCE,
    .init    = relay_init,
    .read    = relay_read,
    .command = relay_command,
    .deinit  = relay_deinit,
};

IO_DRIVER_REGISTER(drv_relay);
