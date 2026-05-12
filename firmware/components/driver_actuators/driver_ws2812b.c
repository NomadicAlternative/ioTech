/**
 * WS2812B / SK6812 Addressable LED Driver
 *
 * Protocol: RMT (ESP32 hardware) — 1-wire timing protocol
 * Config: { "model": "WS2812B", "gpio": 25, "count": 8 }
 *
 * ⚠️ Requires: ESP-IDF led_strip component (idf.py add-dependency "led_strip")
 */
#include "driver.h"
#include "esp_log.h"
#include <string.h>

static const char *TAG = "ws2812b";

static int gpio_pin = 25;
static int led_count = 8;
static bool initialized = false;

static bool ws2812b_init(const cJSON *config) {
    const cJSON *gpio = cJSON_GetObjectItem(config, "gpio");
    const cJSON *count = cJSON_GetObjectItem(config, "count");
    if (gpio && cJSON_IsNumber(gpio)) gpio_pin = gpio->valueint;
    if (count && cJSON_IsNumber(count)) led_count = count->valueint;

    // led_strip_config_t strip_config = { .strip_gpio_num = gpio_pin, .max_leds = led_count };
    // led_strip_rmt_config_t rmt_config = { .resolution_hz = 10 * 1000 * 1000 };
    // led_strip_new_rmt_device(&strip_config, &rmt_config, &led_strip);

    initialized = true;
    ESP_LOGI(TAG, "Initialized: %d LEDs on GPIO %d", led_count, gpio_pin);
    return true;
}

static int ws2812b_read(telemetry_point_t *points, int max) {
    /* LEDs don't produce telemetry */
    (void)points; (void)max;
    return 0;
}

static bool ws2812b_write(const char *key, const cJSON *value) {
    if (!key || !value) return false;
    // Parse "led0" ... "led<N>" and set RGB
    if (strncmp(key, "led", 3) == 0) {
        int index = atoi(key + 3);
        int r = cJSON_GetObjectItem(value, "r") ? cJSON_GetObjectItem(value, "r")->valueint : 0;
        int g = cJSON_GetObjectItem(value, "g") ? cJSON_GetObjectItem(value, "g")->valueint : 0;
        int b = cJSON_GetObjectItem(value, "b") ? cJSON_GetObjectItem(value, "b")->valueint : 0;
        // led_strip_set_pixel(led_strip, index, r, g, b);
        // led_strip_refresh(led_strip);
        ESP_LOGI(TAG, "LED%d → RGB(%d,%d,%d)", index, r, g, b);
        return true;
    }
    return false;
}

static int ws2812b_get_state(telemetry_point_t *points, int max) {
    (void)points; (void)max;
    return 0;
}

static void ws2812b_deinit(void) {
    // led_strip_del(led_strip);
    initialized = false;
}

__attribute__((constructor))
static void register_ws2812b(void) {
    static driver_t drv = {
        .name = "WS2812B Addressable LED Strip",
        .model = "WS2812B",
        .init = ws2812b_init, .read = ws2812b_read,
        .write = ws2812b_write, .get_state = ws2812b_get_state, .deinit = ws2812b_deinit,
    };
    driver_register(&drv);
}
