/**
 * BME280 Temperature, Humidity & Pressure Driver
 *
 * Protocol: I2C (default 0x76, alt 0x77)
 * Config: { "model": "BME280", "i2c_addr": "0x76" }
 *
 * ⚠️ Requires: esp-idf-lib/bme280 or Adafruit_BME280 ported to ESP-IDF
 */
#include "driver.h"
#include "esp_log.h"

static const char *TAG = "bme280";

static float temperature = 0.0f;
static float humidity = 0.0f;
static float pressure = 0.0f;
static bool initialized = false;

static bool bme280_init(const cJSON *config) {
    (void)config;
    // I2C init:
    // i2c_master_init();
    // bme280_init_default_params(&params);
    // params.i2c_addr = 0x76;
    // bme280_init(&dev, &params);
    initialized = true;
    ESP_LOGI(TAG, "Initialized on I2C (0x76)");
    return true;
}

static int bme280_read(telemetry_point_t *points, int max) {
    if (!initialized || max < 3) return 0;
    // float t, h, p;
    // bme280_read_float(&dev, &t, &h, &p);

    points[0] = (telemetry_point_t){
        .capability = CAP_TEMPERATURE, .key = "temperature", .unit = "°C",
        .value = { .f = temperature }, .value_type = 0,
    };
    points[1] = (telemetry_point_t){
        .capability = CAP_HUMIDITY, .key = "humidity", .unit = "%",
        .value = { .f = humidity }, .value_type = 0,
    };
    points[2] = (telemetry_point_t){
        .capability = CAP_PRESSURE, .key = "pressure", .unit = "hPa",
        .value = { .f = pressure }, .value_type = 0,
    };
    return 3;
}

static bool bme280_write(const char *key, const cJSON *value) { (void)key; (void)value; return false; }
static int bme280_get_state(telemetry_point_t *points, int max) { return bme280_read(points, max); }
static void bme280_deinit(void) { initialized = false; }

__attribute__((constructor))
static void register_bme280(void) {
    static driver_t drv = {
        .name = "BME280 Temperature/Humidity/Pressure",
        .model = "BME280",
        .init = bme280_init, .read = bme280_read,
        .write = bme280_write, .get_state = bme280_get_state, .deinit = bme280_deinit,
    };
    driver_register(&drv);
}
