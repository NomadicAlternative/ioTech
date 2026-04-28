#include "relay_controller.h"
#include "driver/gpio.h"
#include "esp_log.h"

static const char *TAG = "relay_controller";

/* GPIO map — relay 1..7 → index 0..6 */
static const gpio_num_t RELAY_GPIOS[RELAY_COUNT] = {
    GPIO_NUM_23,  /* relay 1 */
    GPIO_NUM_22,  /* relay 2 */
    GPIO_NUM_21,  /* relay 3 */
    GPIO_NUM_19,  /* relay 4 */
    GPIO_NUM_18,  /* relay 5 */
    GPIO_NUM_5,   /* relay 6 */
    GPIO_NUM_17,  /* relay 7 */
};

/* Shadow state — true = ON */
static bool s_state[RELAY_COUNT] = {false};

void relay_controller_init(void)
{
    for (int i = 0; i < RELAY_COUNT; i++) {
        gpio_config_t cfg = {
            .pin_bit_mask = (1ULL << RELAY_GPIOS[i]),
            .mode         = GPIO_MODE_OUTPUT,
            .pull_up_en   = GPIO_PULLUP_DISABLE,
            .pull_down_en = GPIO_PULLDOWN_DISABLE,
            .intr_type    = GPIO_INTR_DISABLE,
        };
        gpio_config(&cfg);
        gpio_set_level(RELAY_GPIOS[i], 1);  /* active LOW → 1 = OFF */
        s_state[i] = false;
    }
    ESP_LOGI(TAG, "Relay controller initialized — %d relays, all OFF", RELAY_COUNT);
}

esp_err_t relay_set(uint8_t relay_num, bool on)
{
    if (relay_num < 1 || relay_num > RELAY_COUNT) {
        ESP_LOGE(TAG, "Invalid relay number: %d (valid: 1–%d)", relay_num, RELAY_COUNT);
        return ESP_ERR_INVALID_ARG;
    }

    int idx = relay_num - 1;
    gpio_set_level(RELAY_GPIOS[idx], on ? 0 : 1);  /* active LOW */
    s_state[idx] = on;

    ESP_LOGI(TAG, "Relay %d → %s (GPIO %d)", relay_num, on ? "ON" : "OFF", RELAY_GPIOS[idx]);
    return ESP_OK;
}

bool relay_get(uint8_t relay_num)
{
    if (relay_num < 1 || relay_num > RELAY_COUNT) return false;
    return s_state[relay_num - 1];
}
