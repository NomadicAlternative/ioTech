/**
 * DHT22 Temperature & Humidity Driver
 *
 * Protocol: one-wire, GPIO configurable
 * Config: { "model": "DHT22", "gpio": 14, "interval_ms": 30000 }
 */
#include "driver.h"
#include "driver/rmt_dht.h"  /* ESP-IDF RMT-based DHT driver */
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "dht22";

static int gpio_pin = 14;
static float temperature = 0.0f;
static float humidity = 0.0f;
static bool initialized = false;

static bool dht22_init(const cJSON *config) {
    const cJSON *gpio = cJSON_GetObjectItem(config, "gpio");
    if (gpio && cJSON_IsNumber(gpio)) gpio_pin = gpio->valueint;

    // Initialize RMT-based DHT
    // dht_rmt_init(gpio_pin);  ← platform-specific init
    initialized = true;
    ESP_LOGI(TAG, "Initialized on GPIO %d", gpio_pin);
    return true;
}

static int dht22_read(telemetry_point_t *points, int max) {
    if (!initialized || max < 2) return 0;

    // Read from sensor (simulated for now — real impl uses dht_rmt_read)
    // dht_rmt_read(&temperature, &humidity);

    points[0] = (telemetry_point_t){
        .capability = CAP_TEMPERATURE,
        .key = "temperature",
        .unit = "°C",
        .value = { .f = temperature },
        .value_type = 0,
    };
    points[1] = (telemetry_point_t){
        .capability = CAP_HUMIDITY,
        .key = "humidity",
        .unit = "%",
        .value = { .f = humidity },
        .value_type = 0,
    };
    return 2;
}

static bool dht22_write(const char *key, const cJSON *value) {
    (void)key; (void)value;
    return false; /* DHT22 is read-only */
}

static int dht22_get_state(telemetry_point_t *points, int max) {
    return dht22_read(points, max);
}

static void dht22_deinit(void) {
    initialized = false;
}

/* ── Auto-register ──────────────────────────────────────────────────────── */

__attribute__((constructor))
static void register_dht22(void) {
    static driver_t drv = {
        .name = "DHT22 Temperature & Humidity",
        .model = "DHT22",
        .init = dht22_init,
        .read = dht22_read,
        .write = dht22_write,
        .get_state = dht22_get_state,
        .deinit = dht22_deinit,
    };
    driver_register(&drv);
}
