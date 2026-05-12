/**
 * HC-SR04 Ultrasonic Distance Driver
 *
 * Protocol: GPIO trigger (output) + echo (input), pulse-width measurement
 * Config: { "model": "HC-SR04", "trigger_gpio": 26, "echo_gpio": 27 }
 */
#include "driver.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"

static const char *TAG = "hcsr04";

static int trigger_gpio = 26;
static int echo_gpio = 27;
static float distance = 0.0f;
static bool initialized = false;

#define SOUND_SPEED_CM_US 0.0343f

static bool hcsr04_init(const cJSON *config) {
    const cJSON *trig = cJSON_GetObjectItem(config, "trigger_gpio");
    const cJSON *echo = cJSON_GetObjectItem(config, "echo_gpio");
    if (trig && cJSON_IsNumber(trig)) trigger_gpio = trig->valueint;
    if (echo && cJSON_IsNumber(echo)) echo_gpio = echo->valueint;

    gpio_config_t trig_conf = {
        .pin_bit_mask = (1ULL << trigger_gpio),
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    gpio_config_t echo_conf = {
        .pin_bit_mask = (1ULL << echo_gpio),
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    gpio_config(&trig_conf);
    gpio_config(&echo_conf);
    gpio_set_level(trigger_gpio, 0);
    initialized = true;
    ESP_LOGI(TAG, "Initialized: trigger=GPIO%d echo=GPIO%d", trigger_gpio, echo_gpio);
    return true;
}

static int hcsr04_read(telemetry_point_t *points, int max) {
    if (!initialized || max < 1) return 0;

    // Send 10µs trigger pulse
    gpio_set_level(trigger_gpio, 1);
    esp_rom_delay_us(10);
    gpio_set_level(trigger_gpio, 0);

    // Measure echo pulse width
    int64_t start = 0, end = 0;
    int timeout = 30000; // ~5m max range

    while (gpio_get_level(echo_gpio) == 0 && timeout-- > 0) { esp_rom_delay_us(1); }
    start = esp_timer_get_time();
    timeout = 30000;
    while (gpio_get_level(echo_gpio) == 1 && timeout-- > 0) { esp_rom_delay_us(1); }
    end = esp_timer_get_time();

    if (timeout <= 0) {
        distance = -1.0f; // timeout = no echo
    } else {
        distance = (float)(end - start) * SOUND_SPEED_CM_US / 2.0f;
    }

    points[0] = (telemetry_point_t){
        .capability = CAP_DISTANCE_ULTRASONIC, .key = "distance", .unit = "cm",
        .value = { .f = distance }, .value_type = 0,
    };
    return 1;
}

static bool hcsr04_write(const char *key, const cJSON *value) { (void)key; (void)value; return false; }
static int hcsr04_get_state(telemetry_point_t *points, int max) { return hcsr04_read(points, max); }
static void hcsr04_deinit(void) { initialized = false; }

__attribute__((constructor))
static void register_hcsr04(void) {
    static driver_t drv = {
        .name = "HC-SR04 Ultrasonic Distance",
        .model = "HC-SR04",
        .init = hcsr04_init, .read = hcsr04_read,
        .write = hcsr04_write, .get_state = hcsr04_get_state, .deinit = hcsr04_deinit,
    };
    driver_register(&drv);
}
