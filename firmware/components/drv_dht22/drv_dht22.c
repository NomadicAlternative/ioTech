#include <string.h>
/**
 * @file drv_dht22.c
 * @brief DHT22/DHT11 single-wire temperature + humidity sensor driver.
 *
 * Protocol:
 *   1. Start pulse: pin LOW 20ms, HIGH 30µs, switch to input
 *   2. Response wait: poll for LOW (timeout ~200µs), then HIGH, then data
 *   3. Read 40 bits inside portENTER_CRITICAL spinlock
 *   4. Verify checksum: sum(bytes 0-3) & 0xFF == byte 4
 *   5. Auto-detect DHT11 (bytes 1,3 == 0) vs DHT22
 */
#include "drv_dht22.h"
#include "driver/gpio.h"
#include "rom/ets_sys.h"

#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/portmacro.h"

static const char *TAG = "drv_dht22";

/* ── Driver state ──────────────────────────────────────────────────── */

static uint8_t  s_gpio    = DRV_GPIO_NONE;
static bool     s_ready   = false;
static bool     s_is_dht11 = false;  /* auto-detected */

static portMUX_TYPE s_spinlock = portMUX_INITIALIZER_UNLOCKED;

/* ── Vtable implementation ─────────────────────────────────────────── */

static drv_err_t dht22_init(const driver_config_t *cfg)
{
    if (cfg == NULL) return DRV_ERR_ARG;
    if (cfg->gpio == DRV_GPIO_NONE) {
        ESP_LOGE(TAG, "Invalid GPIO (DRV_GPIO_NONE sentinel)");
        return DRV_ERR_ARG;
    }

    s_gpio  = cfg->gpio;
    s_ready = true;

    /* Keep pin as input with no pull (DHT module has built-in pull-up) */
    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << s_gpio),
        .mode         = GPIO_MODE_INPUT,
        .pull_up_en   = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type    = GPIO_INTR_DISABLE,
    };
    gpio_config(&io_conf);

    ESP_LOGI(TAG, "DHT22 initialized on GPIO %u", s_gpio);
    return DRV_OK;
}

static drv_err_t dht22_read(driver_value_t *values, uint8_t *count)
{
    if (!s_ready) return DRV_ERR_STATE;
    if (values == NULL || count == NULL) return DRV_ERR_ARG;

    *count = 0;

    /* ── 1. Start pulse (matches old working DHT22 code exactly) ───── */
    gpio_set_direction(s_gpio, GPIO_MODE_OUTPUT);
    gpio_set_level(s_gpio, 1);
    esp_rom_delay_us(250);                   /* 250µs HIGH preamble */
    gpio_set_level(s_gpio, 0);
    esp_rom_delay_us(1000);                  /* 1ms LOW */
    gpio_set_level(s_gpio, 1);
    esp_rom_delay_us(30);                    /* 30µs HIGH */
    gpio_set_direction(s_gpio, GPIO_MODE_INPUT);

    /* ── 2. Response wait ──────────────────────────────────────────── */
    int timeout = 0;
    while (gpio_get_level(s_gpio) == 1) { if (++timeout > 200) { ESP_LOGE(TAG, "Response timeout (no LOW from DHT)"); return DRV_ERR_TIMEOUT; } esp_rom_delay_us(1); }
    timeout = 0;
    while (gpio_get_level(s_gpio) == 0) { if (++timeout > 200) { ESP_LOGE(TAG, "Response timeout (no HIGH from DHT)"); return DRV_ERR_TIMEOUT; } esp_rom_delay_us(1); }
    timeout = 0;
    while (gpio_get_level(s_gpio) == 1) { if (++timeout > 200) { ESP_LOGE(TAG, "Response timeout (DHT didn't release line)"); return DRV_ERR_TIMEOUT; } esp_rom_delay_us(1); }

    /* ── 3. Read 40 bits ───────────────────────────────────────────── */
    uint8_t data[5] = {0};
    for (int i = 0; i < 40; i++) {
        timeout = 0;
        while (gpio_get_level(s_gpio) == 0) { if (++timeout > 200) { ESP_LOGE(TAG, "Bit timeout low i=%d", i); return DRV_ERR_TIMEOUT; } esp_rom_delay_us(1); }
        esp_rom_delay_us(30);
        if (gpio_get_level(s_gpio) == 1) data[i / 8] |= (1 << (7 - (i % 8)));
        timeout = 0;
        while (gpio_get_level(s_gpio) == 1) { if (++timeout > 200) { ESP_LOGE(TAG, "Bit timeout high i=%d", i); return DRV_ERR_TIMEOUT; } esp_rom_delay_us(1); }
    }

    /* ── 4. Checksum ─────────────────────────────────────────────── */
    uint8_t checksum = data[0] + data[1] + data[2] + data[3];
    if (checksum != data[4]) {
        ESP_LOGE(TAG, "Checksum mismatch: calc=%02x recv=%02x", checksum, data[4]);
        return DRV_ERR_CHECKSUM;
    }

    /* ── 5. Parse temperature + humidity ──────────────────────────── */
    bool is_dht11 = (data[1] == 0 && data[3] == 0);
    s_is_dht11 = is_dht11;

    double temp, hum;
    if (is_dht11) {
        /* DHT11: 8-bit integer values */
        hum  = (double)data[0];
        temp = (double)data[2];
    } else {
        /* DHT22: high*256 + low, divide by 10 */
        uint16_t raw_hum  = ((uint16_t)data[0] << 8) | data[1];
        uint16_t raw_temp = ((uint16_t)data[2] << 8) | data[3];

        /* Check for negative temperature (bit 15 set) */
        if (raw_temp & 0x8000) {
            raw_temp &= 0x7FFF;
            temp = -((double)raw_temp / 10.0);
        } else {
            temp = (double)raw_temp / 10.0;
        }
        hum = (double)raw_hum / 10.0;
    }

    /* ── 6. Populate output ───────────────────────────────────────── */
    values[0].key[0] = '\0';
    strncpy(values[0].key, "temperature", sizeof(values[0].key) - 1);
    values[0].type = DRV_VAL_NUMBER;
    values[0].number_value = temp;

    values[1].key[0] = '\0';
    strncpy(values[1].key, "humidity", sizeof(values[1].key) - 1);
    values[1].type = DRV_VAL_NUMBER;
    values[1].number_value = hum;

    *count = 2;
    return DRV_OK;
}

static drv_err_t dht22_command(const char *action, const void *arg)
{
    (void)action;
    (void)arg;
    return DRV_ERR_NOT_SUPP; /* read-only sensor */
}

static drv_err_t dht22_deinit(void)
{
    s_ready = false;
    s_gpio = DRV_GPIO_NONE;
    return DRV_OK;
}

/* ── Vtable ────────────────────────────────────────────────────────── */

const driver_t drv_dht22 = {
    .name    = "DHT22",
    .init    = dht22_init,
    .read    = dht22_read,
    .command = dht22_command,
    .deinit  = dht22_deinit,
};

IO_DRIVER_REGISTER(drv_dht22);
