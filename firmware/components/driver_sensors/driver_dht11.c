/**
 * DHT11 Temperature & Humidity Driver (basic)
 *
 * Protocol: 1-wire, GPIO configurable
 * Config: { "model": "DHT11", "gpio": 14 }
 *
 * ⚠️ Same protocol as DHT22 but lower precision (±1°C, ±5% RH) and smaller range.
 */
#include "driver.h"
#include "esp_log.h"

static const char *TAG = "dht11";

static int gpio_pin = 14;
static float temperature = 0.0f;
static float humidity = 0.0f;
static bool initialized = false;

static bool dht11_init(const cJSON *config) {
    const cJSON *gpio = cJSON_GetObjectItem(config, "gpio");
    if (gpio && cJSON_IsNumber(gpio)) gpio_pin = gpio->valueint;
    // dht_rmt_init(gpio_pin, DHT_TYPE_DHT11);
    initialized = true;
    ESP_LOGI(TAG, "Initialized on GPIO %d", gpio_pin);
    return true;
}

static int dht11_read(telemetry_point_t *points, int max) {
    if (!initialized || max < 2) return 0;
    points[0] = (telemetry_point_t){
        .capability = CAP_TEMPERATURE, .key = "temperature", .unit = "°C",
        .value = { .f = temperature }, .value_type = 0,
    };
    points[1] = (telemetry_point_t){
        .capability = CAP_HUMIDITY, .key = "humidity", .unit = "%",
        .value = { .f = humidity }, .value_type = 0,
    };
    return 2;
}

static bool dht11_write(const char *key, const cJSON *value) { (void)key; (void)value; return false; }
static int dht11_get_state(telemetry_point_t *points, int max) { return dht11_read(points, max); }
static void dht11_deinit(void) { initialized = false; }

__attribute__((constructor))
static void register_dht11(void) {
    static driver_t drv = {
        .name = "DHT11 Temperature & Humidity (Basic)",
        .model = "DHT11",
        .init = dht11_init, .read = dht11_read,
        .write = dht11_write, .get_state = dht11_get_state, .deinit = dht11_deinit,
    };
    driver_register(&drv);
}
