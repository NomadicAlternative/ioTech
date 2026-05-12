/**
 * PIR HC-SR501 Motion Sensor Driver
 *
 * Protocol: GPIO digital (HIGH = motion detected)
 * Config: { "model": "PIR", "gpio": 27 }
 */
#include "driver.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "pir";

static int gpio_pin = 27;
static bool motion = false;
static bool initialized = false;

static bool pir_init(const cJSON *config) {
    const cJSON *gpio = cJSON_GetObjectItem(config, "gpio");
    if (gpio && cJSON_IsNumber(gpio)) gpio_pin = gpio->valueint;

    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << gpio_pin),
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    gpio_config(&io_conf);
    initialized = true;
    ESP_LOGI(TAG, "Initialized on GPIO %d", gpio_pin);
    return true;
}

static int pir_read(telemetry_point_t *points, int max) {
    if (!initialized || max < 1) return 0;
    motion = gpio_get_level(gpio_pin) == 1;

    points[0] = (telemetry_point_t){
        .capability = CAP_MOTION, .key = "motion", .value = { .b = motion }, .value_type = 2,
    };
    return 1;
}

static bool pir_write(const char *key, const cJSON *value) { (void)key; (void)value; return false; }
static int pir_get_state(telemetry_point_t *points, int max) { return pir_read(points, max); }
static void pir_deinit(void) { initialized = false; }

__attribute__((constructor))
static void register_pir(void) {
    static driver_t drv = {
        .name = "PIR HC-SR501 Motion Sensor",
        .model = "PIR",
        .init = pir_init, .read = pir_read,
        .write = pir_write, .get_state = pir_get_state, .deinit = pir_deinit,
    };
    driver_register(&drv);
}
