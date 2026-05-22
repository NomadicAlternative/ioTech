/**
 * @file drv_bme280.c
 * @brief BME280 I2C temperature + humidity + pressure sensor driver.
 *
 * Full Bosch BME280 compensation formula per datasheet rev 1.6 §4.2.3.
 * Reads all 26 calibration registers on init. Forced-mode single measurement
 * per read() cycle with T/H/P ×1 oversampling.
 */
#include "drv_bme280.h"
#include "pal_i2c.h"
#include "pal_delay.h"
#include "esp_log.h"
#include <string.h>
#include <math.h>

static const char *TAG = "drv_bme280";

/* ── I2C constants ────────────────────────────────────────────────── */
#define BME280_ADDR_DEFAULT  0x76
#define BME280_ADDR_ALT      0x77
#define BME280_REG_ID        0xD0
#define BME280_CHIP_ID       0x60
#define BME280_REG_CTRL_MEAS 0xF4
#define BME280_REG_CTRL_HUM  0xF2
#define BME280_REG_CONFIG    0xF5
#define BME280_REG_STATUS    0xF3
#define BME280_REG_PRESS_MSB 0xF7

/* Data length: press(3) + temp(3) + hum(2) = 8 bytes from 0xF7 */
#define BME280_DATA_LEN      8

/* ── Calibration structure (26 registers, Bosch §4.2.2) ────────────── */
typedef struct {
    /* Temperature */
    uint16_t dig_T1;
    int16_t  dig_T2;
    int16_t  dig_T3;
    /* Pressure */
    uint16_t dig_P1;
    int16_t  dig_P2;
    int16_t  dig_P3;
    int16_t  dig_P4;
    int16_t  dig_P5;
    int16_t  dig_P6;
    int16_t  dig_P7;
    int16_t  dig_P8;
    int16_t  dig_P9;
    /* Humidity */
    uint8_t  dig_H1;
    int16_t  dig_H2;
    uint8_t  dig_H3;
    int16_t  dig_H4;
    int16_t  dig_H5;
    int8_t   dig_H6;
} bme280_calib_t;

/* ── Driver state ──────────────────────────────────────────────────── */
static uint8_t        s_i2c_addr = 0;
static bool           s_initialized = false;
static bme280_calib_t s_calib;
static int32_t        s_t_fine;  /* global temperature fine value for press/hum compensation */

/* ── Calibration read ──────────────────────────────────────────────── */
static bool bme280_read_calibration(void) {
    uint8_t cal1[26]; /* registers 0x88–0xA1 */
    uint8_t cal2[7];  /* registers 0xE1–0xE7 */

    if (pal_i2c_master_read(s_i2c_addr, 0x88, cal1, sizeof(cal1)) != ESP_OK) {
        ESP_LOGE(TAG, "Failed to read cal1 block");
        return false;
    }
    if (pal_i2c_master_read(s_i2c_addr, 0xE1, cal2, sizeof(cal2)) != ESP_OK) {
        ESP_LOGE(TAG, "Failed to read cal2 block");
        return false;
    }

    s_calib.dig_T1 = (uint16_t)(cal1[0]  | (cal1[1]  << 8));
    s_calib.dig_T2 = (int16_t) (cal1[2]  | (cal1[3]  << 8));
    s_calib.dig_T3 = (int16_t) (cal1[4]  | (cal1[5]  << 8));
    s_calib.dig_P1 = (uint16_t)(cal1[6]  | (cal1[7]  << 8));
    s_calib.dig_P2 = (int16_t) (cal1[8]  | (cal1[9]  << 8));
    s_calib.dig_P3 = (int16_t) (cal1[10] | (cal1[11] << 8));
    s_calib.dig_P4 = (int16_t) (cal1[12] | (cal1[13] << 8));
    s_calib.dig_P5 = (int16_t) (cal1[14] | (cal1[15] << 8));
    s_calib.dig_P6 = (int16_t) (cal1[16] | (cal1[17] << 8));
    s_calib.dig_P7 = (int16_t) (cal1[18] | (cal1[19] << 8));
    s_calib.dig_P8 = (int16_t) (cal1[20] | (cal1[21] << 8));
    s_calib.dig_P9 = (int16_t) (cal1[22] | (cal1[23] << 8));
    s_calib.dig_H1 = cal1[25]; /* 0xA1 */
    s_calib.dig_H2 = (int16_t)(cal2[0]  | (cal2[1]  << 8));
    s_calib.dig_H3 = cal2[2];
    s_calib.dig_H4 = (int16_t)((cal2[3] << 4) | (cal2[4] & 0x0F));
    s_calib.dig_H5 = (int16_t)((cal2[5] << 4) | (cal2[4] >> 4));
    s_calib.dig_H6 = (int8_t)  cal2[6];

    ESP_LOGI(TAG, "Calibration loaded: T1=%u H1=%u", s_calib.dig_T1, s_calib.dig_H1);
    return true;
}

/* ── Bosch compensation formulas (§4.2.3) ──────────────────────────── */

/** Returns temperature in °C, stores t_fine for pressure/humidity compensation */
static double bme280_compensate_temp(int32_t adc_T) {
    int32_t var1 = ((((adc_T >> 3) - ((int32_t)s_calib.dig_T1 << 1))) *
                    ((int32_t)s_calib.dig_T2)) >> 11;
    int32_t var2 = (((((adc_T >> 4) - ((int32_t)s_calib.dig_T1)) *
                      ((adc_T >> 4) - ((int32_t)s_calib.dig_T1))) >> 12) *
                    ((int32_t)s_calib.dig_T3)) >> 14;
    s_t_fine = var1 + var2;
    return (double)((s_t_fine * 5 + 128) >> 8) / 100.0;
}

static double bme280_compensate_pressure(int32_t adc_P) {
    int64_t var1 = ((int64_t)s_t_fine) - 128000;
    int64_t var2 = var1 * var1 * (int64_t)s_calib.dig_P6;
    var2 = var2 + ((var1 * (int64_t)s_calib.dig_P5) << 17);
    var2 = var2 + (((int64_t)s_calib.dig_P4) << 35);
    var1 = ((var1 * var1 * (int64_t)s_calib.dig_P3) >> 8) +
           ((var1 * (int64_t)s_calib.dig_P2) << 12);
    var1 = (((((int64_t)1) << 47) + var1)) * ((int64_t)s_calib.dig_P1) >> 33;
    if (var1 == 0) return 0.0;

    int64_t p = 1048576 - adc_P;
    p = (((p << 31) - var2) * 3125) / var1;
    var1 = (((int64_t)s_calib.dig_P9) * (p >> 13) * (p >> 13)) >> 25;
    var2 = (((int64_t)s_calib.dig_P8) * p) >> 19;
    p = ((p + var1 + var2) >> 8) + (((int64_t)s_calib.dig_P7) << 4);
    return (double)p / 256.0;
}

static double bme280_compensate_humidity(int32_t adc_H) {
    int32_t v_x1_u32r = (s_t_fine - ((int32_t)76800));
    v_x1_u32r = (((((adc_H << 14) - (((int32_t)s_calib.dig_H4) << 20) -
                    (((int32_t)s_calib.dig_H5) * v_x1_u32r)) + ((int32_t)16384)) >> 15) *
                 (((((((v_x1_u32r * ((int32_t)s_calib.dig_H6)) >> 10) *
                     (((v_x1_u32r * ((int32_t)s_calib.dig_H3)) >> 11) +
                      ((int32_t)32768))) >> 10) + ((int32_t)2097152)) *
                   ((int32_t)s_calib.dig_H2) + 8192) >> 14));
    v_x1_u32r = (v_x1_u32r - (((((v_x1_u32r >> 15) * (v_x1_u32r >> 15)) >> 7) *
                               ((int32_t)s_calib.dig_H1)) >> 4));
    v_x1_u32r = (v_x1_u32r < 0 ? 0 : v_x1_u32r);
    v_x1_u32r = (v_x1_u32r > 419430400 ? 419430400 : v_x1_u32r);
    return (double)(v_x1_u32r >> 12) / 1024.0;
}

/* ── Driver vtable ─────────────────────────────────────────────────── */

static drv_err_t bme280_init(const driver_config_t *cfg) {
    if (!cfg) return DRV_ERR_ARG;

    s_i2c_addr = cfg->i2c_addr ? (uint8_t)cfg->i2c_addr : BME280_ADDR_DEFAULT;

    esp_err_t err = pal_i2c_master_init(cfg->i2c_sda, cfg->i2c_scl, 100000);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "I2C init failed");
        return DRV_ERR_BUS;
    }

    /* Verify chip ID */
    uint8_t id = 0;
    pal_i2c_master_read(s_i2c_addr, BME280_REG_ID, &id, 1);
    if (id != BME280_CHIP_ID) {
        ESP_LOGW(TAG, "Bad chip ID 0x%02x at addr 0x%02x", id, s_i2c_addr);
        return DRV_ERR_BUS;
    }

    /* Read full 26-register calibration data per Bosch datasheet */
    if (!bme280_read_calibration()) {
        ESP_LOGE(TAG, "Calibration read failed");
        return DRV_ERR_BUS;
    }

    /* Configure humidity oversampling ×1 (must be written before ctrl_meas) */
    uint8_t hum_cfg = 0x01; /* osrs_h = 001 (×1 oversampling) */
    pal_i2c_master_write(s_i2c_addr, &hum_cfg, 1);

    s_initialized = true;
    ESP_LOGI(TAG, "BME280 initialized at 0x%02x", s_i2c_addr);
    return DRV_OK;
}

static drv_err_t bme280_read(driver_value_t *values, uint8_t *count) {
    if (!s_initialized || !values || !count) return DRV_ERR_STATE;
    *count = 0;

    /* Forced mode: T×1, P×1, mode=01 */
    uint8_t ctrl_meas = 0x25; /* osrs_t=001, osrs_p=001, mode=01 */
    pal_i2c_master_write(s_i2c_addr, &ctrl_meas, 1);

    /* Wait for measurement (max ~9.3ms at ×1 oversampling per datasheet) */
    pal_delay_ms(10);

    /* Read 8-byte data block from 0xF7: press[3] temp[3] hum[2] */
    uint8_t data[BME280_DATA_LEN] = {0};
    if (pal_i2c_master_read(s_i2c_addr, BME280_REG_PRESS_MSB, data, BME280_DATA_LEN) != ESP_OK) {
        ESP_LOGW(TAG, "I2C read failed");
        return DRV_ERR_BUS;
    }

    /* Extract raw ADC values (20-bit pressure/temp, 16-bit humidity) */
    int32_t adc_P = ((int32_t)data[0] << 12) | ((int32_t)data[1] << 4) | (data[2] >> 4);
    int32_t adc_T = ((int32_t)data[3] << 12) | ((int32_t)data[4] << 4) | (data[5] >> 4);
    int32_t adc_H = ((int32_t)data[6] << 8)  | data[7];

    /* Full Bosch compensation */
    double temperature = bme280_compensate_temp(adc_T);
    double pressure    = bme280_compensate_pressure(adc_P);
    double humidity    = bme280_compensate_humidity(adc_H);

    /* Clamp physically impossible values */
    if (humidity    < 0.0) humidity    = 0.0;
    if (humidity    > 100.0) humidity  = 100.0;
    if (pressure    < 30000.0) pressure = 30000.0;  /* below Dead Sea level */
    if (pressure    > 110000.0) pressure = 110000.0;

    strncpy(values[0].key, "temperature", 31);
    values[0].type = DRV_VAL_NUMBER;
    values[0].number_value = temperature;

    strncpy(values[1].key, "humidity", 31);
    values[1].type = DRV_VAL_NUMBER;
    values[1].number_value = humidity;

    strncpy(values[2].key, "pressure", 31);
    values[2].type = DRV_VAL_NUMBER;
    values[2].number_value = pressure;

    *count = 3;
    return DRV_OK;
}

static drv_err_t bme280_command(const char *action, const void *arg) {
    (void)action; (void)arg;
    return DRV_ERR_NOT_SUPP;
}

static drv_err_t bme280_deinit(void) {
    s_initialized = false;
    return DRV_OK;
}

const driver_t drv_bme280 = {
    .name    = "BME280",
    .init    = bme280_init,
    .read    = bme280_read,
    .command = bme280_command,
    .deinit  = bme280_deinit,
};
IO_DRIVER_REGISTER(drv_bme280);
