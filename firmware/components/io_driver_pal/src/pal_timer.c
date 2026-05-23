/**
 * @file pal_timer.c
 * @brief PAL Timer — wraps esp_timer.
 */
#include "pal_timer.h"
#include <esp_timer.h>
#include "esp_log.h"

static const char *TAG = "pal_timer";

static esp_timer_handle_t s_timer_handle = NULL;

esp_err_t pal_timer_start_us(uint64_t period_us, pal_timer_cb_t cb, void *arg)
{
    if (s_timer_handle) {
        ESP_LOGW(TAG, "Timer already running, stopping first");
        pal_timer_stop();
    }

    esp_timer_create_args_t timer_args = {
        .callback = (void (*)(void *))cb,
        .arg      = arg,
        .name     = "pal_timer",
    };

    esp_err_t err = esp_timer_create(&timer_args, &s_timer_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "esp_timer_create failed: %s", esp_err_to_name(err));
        return err;
    }

    err = esp_timer_start_once(s_timer_handle, period_us);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "esp_timer_start_once failed: %s", esp_err_to_name(err));
        esp_timer_delete(s_timer_handle);
        s_timer_handle = NULL;
    }
    return err;
}

uint64_t pal_timer_get_us(void)
{
    return esp_timer_get_time();
}

esp_err_t pal_timer_stop(void)
{
    if (s_timer_handle) {
        esp_timer_stop(s_timer_handle);
        esp_timer_delete(s_timer_handle);
        s_timer_handle = NULL;
    }
    return ESP_OK;
}
