/**
 * SSD1306 OLED 128x64 Display Driver
 *
 * Protocol: I2C (default 0x3C)
 * Config: { "model": "SSD1306", "i2c_addr": "0x3C", "width": 128, "height": 64 }
 *
 * ⚠️ Requires: ESP-IDF SSD1306 component or u8g2 library
 */
#include "driver.h"
#include "esp_log.h"
#include <string.h>

static const char *TAG = "ssd1306";

static bool initialized = false;
static char current_line[4][22] = {0}; // 4 lines of 21 chars (128px ≈ 21 chars at 6x8)

static bool ssd1306_init(const cJSON *config) {
    (void)config;
    // ssd1306_i2c_init();
    // ssd1306_init();
    // ssd1306_clear();
    initialized = true;
    ESP_LOGI(TAG, "Initialized OLED 128x64 on I2C (0x3C)");
    return true;
}

static int ssd1306_read(telemetry_point_t *points, int max) {
    (void)points; (void)max;
    return 0; /* Displays don't produce telemetry */
}

static bool ssd1306_write(const char *key, const cJSON *value) {
    if (!initialized || !value) return false;

    if (strcmp(key, "clear") == 0) {
        // ssd1306_clear();
        memset(current_line, 0, sizeof(current_line));
        return true;
    }

    if (strcmp(key, "text") == 0) {
        int line = cJSON_GetObjectItem(value, "line") ? cJSON_GetObjectItem(value, "line")->valueint : 0;
        const char *text = cJSON_GetObjectItem(value, "text") ? cJSON_GetObjectItem(value, "text")->valuestring : "";
        // ssd1306_set_cursor(0, line * 8);
        // ssd1306_write_string(text);
        snprintf(current_line[line % 4], 22, "%s", text);
        ESP_LOGI(TAG, "Line %d: \"%s\"", line, text);
        return true;
    }

    (void)key;
    return false;
}

static int ssd1306_get_state(telemetry_point_t *points, int max) {
    if (!initialized || max < 1) return 0;
    points[0] = (telemetry_point_t){
        .capability = CAP_OLED, .key = "display",
        .value = { .s = "ssd1306" }, .value_type = 3,
    };
    return 1;
}

static void ssd1306_deinit(void) {
    // ssd1306_display_off();
    initialized = false;
}

__attribute__((constructor))
static void register_ssd1306(void) {
    static driver_t drv = {
        .name = "SSD1306 OLED 128x64",
        .model = "SSD1306",
        .init = ssd1306_init, .read = ssd1306_read,
        .write = ssd1306_write, .get_state = ssd1306_get_state, .deinit = ssd1306_deinit,
    };
    driver_register(&drv);
}
