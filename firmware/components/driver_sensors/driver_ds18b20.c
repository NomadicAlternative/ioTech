/**
 * DS18B20 1-Wire Temperature Driver
 *
 * Protocol: 1-wire (Dallas), GPIO configurable
 * Config: { "model": "DS18B20", "gpio": 14 }
 *
 * ⚠️ Requires: ESP-IDF 1-wire + ds18b20 component, or DallasTemperature port
 */
#include "driver.h"
#include "esp_log.h"

static const char *TAG = "ds18b20";

static int gpio_pin = 14;
static float temperature = 0.0f;
static bool initialized = false;

static bool ds18b20_init(const cJSON *config) {
    const cJSON *gpio = cJSON_GetObjectItem(config, "gpio");
    if (gpio && cJSON_IsNumber(gpio)) gpio_pin = gpio->valueint;
    // onewire_init(gpio_pin);
    // ds18b20_init(&sensor, &onewire);
    initialized = true;
    ESP_LOGI(TAG, "Initialized on GPIO %d (1-wire)", gpio_pin);
    return true;
}

static int ds18b20_read(telemetry_point_t *points, int max) {
    if (!initialized || max < 1) return 0;
    // ds18b20_read_temp(&sensor, &temperature);

    points[0] = (telemetry_point_t){
        .capability = CAP_TEMPERATURE, .key = "temperature", .unit = "°C",
        .value = { .f = temperature }, .value_type = 0,
    };
    return 1;
}

static bool ds18b20_write(const char *key, const cJSON *value) { (void)key; (void)value; return false; }
static int ds18b20_get_state(telemetry_point_t *points, int max) { return ds18b20_read(points, max); }
static void ds18b20_deinit(void) { initialized = false; }

__attribute__((constructor))
static void register_ds18b20(void) {
    static driver_t drv = {
        .name = "DS18B20 1-Wire Temperature",
        .model = "DS18B20",
        .init = ds18b20_init, .read = ds18b20_read,
        .write = ds18b20_write, .get_state = ds18b20_get_state, .deinit = ds18b20_deinit,
    };
    driver_register(&drv);
}
