/**
 * Servo SG90 / MG996R Driver
 *
 * Protocol: PWM (LEDC peripheral, 50Hz, 0.5-2.5ms pulse)
 * Config: { "model": "SERVO", "gpio": 18, "min_angle": 0, "max_angle": 180 }
 */
#include "driver.h"
#include "driver/ledc.h"
#include "esp_log.h"
#include <string.h>

static const char *TAG = "servo";

static int gpio_pin = 18;
static int current_angle = 90;
static int min_angle = 0;
static int max_angle = 180;
static bool initialized = false;

#define SERVO_FREQ_HZ    50
#define SERVO_MIN_US     500
#define SERVO_MAX_US     2500
#define LEDC_RESOLUTION  LEDC_TIMER_16_BIT

static int angle_to_duty(int angle) {
    if (angle < min_angle) angle = min_angle;
    if (angle > max_angle) angle = max_angle;
    int pulse_us = SERVO_MIN_US + (SERVO_MAX_US - SERVO_MIN_US) * angle / (max_angle - min_angle);
    return (pulse_us * 65536) / 20000; // 16-bit duty for 50Hz (20ms period)
}

static bool servo_init(const cJSON *config) {
    const cJSON *gpio = cJSON_GetObjectItem(config, "gpio");
    if (gpio && cJSON_IsNumber(gpio)) gpio_pin = gpio->valueint;

    ledc_timer_config_t timer = {
        .speed_mode = LEDC_LOW_SPEED_MODE,
        .duty_resolution = LEDC_RESOLUTION,
        .timer_num = LEDC_TIMER_0,
        .freq_hz = SERVO_FREQ_HZ,
        .clk_cfg = LEDC_AUTO_CLK,
    };
    ledc_timer_config(&timer);

    ledc_channel_config_t channel = {
        .speed_mode = LEDC_LOW_SPEED_MODE,
        .channel = LEDC_CHANNEL_0,
        .timer_sel = LEDC_TIMER_0,
        .intr_type = LEDC_INTR_DISABLE,
        .gpio_num = gpio_pin,
        .duty = angle_to_duty(current_angle),
        .hpoint = 0,
    };
    ledc_channel_config(&channel);

    initialized = true;
    ESP_LOGI(TAG, "Initialized on GPIO %d (PWM 50Hz)", gpio_pin);
    return true;
}

static int servo_read(telemetry_point_t *points, int max) {
    (void)points; (void)max;
    return 0;
}

static bool servo_write(const char *key, const cJSON *value) {
    if (!initialized) return false;
    const cJSON *angle = cJSON_GetObjectItem(value, "angle");
    if (angle && cJSON_IsNumber(angle)) {
        current_angle = angle->valueint;
        ledc_set_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0, angle_to_duty(current_angle));
        ledc_update_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0);
        ESP_LOGI(TAG, "Angle → %d°", current_angle);
        return true;
    }
    (void)key;
    return false;
}

static int servo_get_state(telemetry_point_t *points, int max) {
    if (!initialized || max < 1) return 0;
    points[0] = (telemetry_point_t){
        .capability = CAP_SERVO, .key = "angle", .unit = "°",
        .value = { .f = (float)current_angle }, .value_type = 0,
    };
    return 1;
}

static void servo_deinit(void) {
    ledc_stop(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0, 0);
    initialized = false;
}

__attribute__((constructor))
static void register_servo(void) {
    static driver_t drv = {
        .name = "Servo Motor SG90/MG996R",
        .model = "SERVO",
        .init = servo_init, .read = servo_read,
        .write = servo_write, .get_state = servo_get_state, .deinit = servo_deinit,
    };
    driver_register(&drv);
}
