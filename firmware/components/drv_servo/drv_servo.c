/** @file drv_servo.c — Servo motor driver via LEDC hardware PWM.
 *
 * Generates continuous 50 Hz PWM with 1-2 ms duty cycle for standard
 * hobby servos. Uses ESP-IDF LEDC peripheral (same API on ESP32/C3/S3).
 *
 * Pulse width: 500 µs (0°) to 2500 µs (180°), centered at 1500 µs (90°).
 * Period: 20 ms (50 Hz) — LEDC auto-repeats, no CPU intervention after setup.
 */
#include "drv_servo.h"
#include "driver/ledc.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>

static const char *TAG = "drv_servo";

#define SERVO_LEDC_MODE      LEDC_LOW_SPEED_MODE
#define SERVO_LEDC_CHANNEL   LEDC_CHANNEL_0
#define SERVO_LEDC_TIMER     LEDC_TIMER_0
#define SERVO_LEDC_FREQ      50        /* 50 Hz = 20 ms period */
#define SERVO_LEDC_RES       LEDC_TIMER_14_BIT  /* 14-bit resolution (max across all targets) */

/* Duty range for standard servo: 0.5 ms (0°) → 2.5 ms (180°) */
#define SERVO_DUTY_MIN_US    500
#define SERVO_DUTY_MAX_US    2500
#define SERVO_PERIOD_US      20000     /* 50 Hz = 20,000 µs */

static uint8_t s_gpio  = DRV_GPIO_NONE;
static bool    s_ready = false;

/* Convert angle (0-180) to LEDC duty value at 16-bit resolution.
 * duty = angle_mapped_us / period_us * max_duty
 * max_duty = 2^14 - 1 = 16383 at 14-bit resolution */
static uint32_t angle_to_duty(uint8_t angle_deg) {
    uint32_t pulse_us = SERVO_DUTY_MIN_US +
                        ((uint32_t)angle_deg * (SERVO_DUTY_MAX_US - SERVO_DUTY_MIN_US)) / 180;
    return (pulse_us * ((1UL << 14) - 1)) / SERVO_PERIOD_US;
}

/* Write angle to servo via LEDC duty cycle update */
static void servo_write(uint8_t angle) {
    if (!s_ready) return;
    uint32_t duty = angle_to_duty(angle);
    ledc_set_duty(SERVO_LEDC_MODE, SERVO_LEDC_CHANNEL, duty);
    ledc_update_duty(SERVO_LEDC_MODE, SERVO_LEDC_CHANNEL);
}

/* ── Driver vtable ─────────────────────────────────────────────────── */

static drv_err_t servo_init(const driver_config_t *cfg) {
    if (!cfg || cfg->gpio == DRV_GPIO_NONE) return DRV_ERR_ARG;
    s_gpio = cfg->gpio;

    /* Configure LEDC timer: 50 Hz, 16-bit resolution */
    ledc_timer_config_t timer_cfg = {
        .speed_mode      = SERVO_LEDC_MODE,
        .duty_resolution = SERVO_LEDC_RES,
        .timer_num       = SERVO_LEDC_TIMER,
        .freq_hz         = SERVO_LEDC_FREQ,
        .clk_cfg         = LEDC_AUTO_CLK,
    };
    esp_err_t err = ledc_timer_config(&timer_cfg);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "LEDC timer config failed: %s", esp_err_to_name(err));
        return DRV_ERR_INTERNAL;
    }

    /* Configure LEDC channel: output to GPIO */
    ledc_channel_config_t chan_cfg = {
        .gpio_num   = s_gpio,
        .speed_mode = SERVO_LEDC_MODE,
        .channel    = SERVO_LEDC_CHANNEL,
        .intr_type  = LEDC_INTR_DISABLE,
        .timer_sel  = SERVO_LEDC_TIMER,
        .duty       = angle_to_duty(90),  /* start centered */
        .hpoint     = 0,
    };
    err = ledc_channel_config(&chan_cfg);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "LEDC channel config failed: %s", esp_err_to_name(err));
        return DRV_ERR_INTERNAL;
    }

    s_ready = true;
    ESP_LOGI(TAG, "Servo initialized on GPIO %u", s_gpio);
    return DRV_OK;
}

static drv_err_t servo_read(driver_value_t *values, uint8_t *count) {
    if (!s_ready || !values || !count) return DRV_ERR_STATE;

    /* Read back current duty and convert to approximate angle */
    uint32_t duty = ledc_get_duty(SERVO_LEDC_MODE, SERVO_LEDC_CHANNEL);
    uint32_t pulse_us = (duty * SERVO_PERIOD_US) / ((1UL << 14) - 1);
    uint8_t angle = (uint8_t)(((pulse_us - SERVO_DUTY_MIN_US) * 180) /
                               (SERVO_DUTY_MAX_US - SERVO_DUTY_MIN_US));

    strncpy(values[0].key, "servo_angle", 31);
    values[0].type = DRV_VAL_NUMBER;
    values[0].number_value = (double)angle;
    *count = 1;
    return DRV_OK;
}

static drv_err_t servo_command(const char *action, const void *arg) {
    if (!s_ready || !action || !arg) return DRV_ERR_STATE;
    const cJSON *root = (const cJSON *)arg;

    if (strcmp(action, "servo_set") == 0) {
        cJSON *j_a = cJSON_GetObjectItem(root, "angle");
        if (!cJSON_IsNumber(j_a)) return DRV_ERR_ARG;
        int angle = j_a->valueint;
        if (angle < 0 || angle > 180) return DRV_ERR_ARG;
        servo_write((uint8_t)angle);
        return DRV_OK;
    }

    if (strcmp(action, "servo_center") == 0) {
        servo_write(90);
        return DRV_OK;
    }

    if (strcmp(action, "servo_off") == 0) {
        /* Set duty to 0 to stop PWM output */
        ledc_set_duty(SERVO_LEDC_MODE, SERVO_LEDC_CHANNEL, 0);
        ledc_update_duty(SERVO_LEDC_MODE, SERVO_LEDC_CHANNEL);
        return DRV_OK;
    }

    return DRV_ERR_NOT_SUPP;
}

static drv_err_t servo_deinit(void) {
    s_ready = false;
    ledc_stop(SERVO_LEDC_MODE, SERVO_LEDC_CHANNEL, 0);
    return DRV_OK;
}

const driver_t drv_servo = {
    .name    = "SERVO",
    .init    = servo_init,
    .read    = servo_read,
    .command = servo_command,
    .deinit  = servo_deinit,
};
IO_DRIVER_REGISTER(drv_servo);
