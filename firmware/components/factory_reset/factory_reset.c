#include <stdbool.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"
#include "esp_log.h"

#include "factory_reset.h"
#include "nvs_storage.h"
#include "sm_events.h"

static const char *TAG = "factory_reset";

/* -----------------------------------------------------------------------
 * Pure logic — easily unit-testable on native platform
 * --------------------------------------------------------------------- */
bool factory_reset_should_trigger(uint32_t pressed_ms, uint32_t threshold_ms)
{
    return pressed_ms >= threshold_ms;
}

/* -----------------------------------------------------------------------
 * GPIO monitor task
 * --------------------------------------------------------------------- */
static void factory_reset_task(void *arg)
{
    /* Configure GPIO as input with pull-up */
    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << FACTORY_RESET_GPIO_PIN),
        .mode         = GPIO_MODE_INPUT,
        .pull_up_en   = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type    = GPIO_INTR_DISABLE,
    };
    gpio_config(&io_conf);

    ESP_LOGI(TAG, "Factory reset monitor active on GPIO %d", FACTORY_RESET_GPIO_PIN);

    uint32_t hold_ms = 0;
    const uint32_t poll_interval_ms = 100;

    for (;;) {
        int level = gpio_get_level(FACTORY_RESET_GPIO_PIN);

        if (level == 0) {
            /* Button pressed (active LOW) */
            hold_ms += poll_interval_ms;

            if (factory_reset_should_trigger(hold_ms, FACTORY_RESET_HOLD_MS)) {
                ESP_LOGW(TAG, "Factory reset triggered (held %lums)", (unsigned long)hold_ms);
                sm_send_event(SM_EVT_FACTORY_RESET);
                vTaskDelete(NULL);
                return;
            }
        } else {
            /* Button released — reset counter */
            if (hold_ms > 0 && hold_ms < FACTORY_RESET_HOLD_MS) {
                ESP_LOGD(TAG, "Short press ignored (%lums)", (unsigned long)hold_ms);
            }
            hold_ms = 0;
        }

        vTaskDelay(pdMS_TO_TICKS(poll_interval_ms));
    }
}

void factory_reset_monitor_start(void)
{
    xTaskCreate(factory_reset_task, "factory_reset", 2048, NULL, 4, NULL);
}
