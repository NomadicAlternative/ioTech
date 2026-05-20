/** @file drv_ws2812b.c — WS2812B addressable RGB LED strip via RMT.
 *
 * Builds per-bit RMT items using the ESP32 legacy RMT driver.
 *
 * WS2812B timing at 5 MHz RMT resolution (0.2 µs/tick):
 *   T0H = 2 ticks (0.4 µs), T0L = 4 ticks (0.8 µs)  → bit 0
 *   T1H = 4 ticks (0.8 µs), T1L = 2 ticks (0.4 µs)  → bit 1
 *   RES = 50 µs low at end (handled by RMT idle)
 *
 * ESP32-C3 support: NOT YET IMPLEMENTED (different RMT API).
 */
#include "drv_ws2812b.h"
#include "pal_rmt.h"
#include "pal_delay.h"
#include "driver/rmt.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>

static const char *TAG = "drv_ws2812b";

#define WS2812_MAX_LEDS  256
#define RMT_CHANNEL      0
#define RMT_RESOLUTION_HZ 5000000  /* 5 MHz → 0.2 µs/tick */

/* WS2812B bit encoding at 5 MHz */
#define WS2812_T0H  2   /* 0.4 µs high */
#define WS2812_T0L  4   /* 0.8 µs low */
#define WS2812_T1H  4   /* 0.8 µs high */
#define WS2812_T1L  2   /* 0.4 µs low */

/* GRB color order */
#define WS2812_COLOR_ORDER_G 0
#define WS2812_COLOR_ORDER_R 1
#define WS2812_COLOR_ORDER_B 2

static uint8_t  s_gpio      = 0;
static uint16_t s_led_count = 0;
static uint8_t  s_buffer[WS2812_MAX_LEDS * 3];
static bool     s_ready     = false;

/* Per-bit RMT item: one rmt_item32_t encodes 2 bits (level+duration pair) */
static void ws2812_build_items(rmt_item32_t *items, int item_count,
                                const uint8_t *data, int num_bytes) {
    int idx = 0;
    for (int b = 0; b < num_bytes && idx < item_count; b++) {
        uint8_t byte = data[b];
        for (int bit = 7; bit >= 0; bit--) {
            bool is_one = (byte >> bit) & 1;
            /* RMT items use (duration0, level0) then (duration1, level1) */
            /* First half: high pulse */
            items[idx].duration0 = is_one ? WS2812_T1H : WS2812_T0H;
            items[idx].level0    = 1;
            /* Second half: low period */
            items[idx].duration1 = is_one ? WS2812_T1L : WS2812_T0L;
            items[idx].level1    = 0;
            idx++;
        }
    }
}

static void ws2812_flush(void) {
    if (!s_ready || s_led_count == 0) return;

    /* Build GRB data: [G0,R0,B0, G1,R1,B1, ...] */
    int num_bytes = s_led_count * 3;
    int num_items = num_bytes * 8; /* 8 bits per byte, 1 RMT item per bit */

    /* Allocate RMT items on stack for small strips, heap for large ones */
    rmt_item32_t stack_items[64 * 3 * 8]; /* ~64 LEDs on stack */
    rmt_item32_t *items = stack_items;
    bool heap_alloc = false;

    if ((size_t)num_items > sizeof(stack_items) / sizeof(stack_items[0])) {
        items = (rmt_item32_t *)malloc(num_items * sizeof(rmt_item32_t));
        if (!items) {
            ESP_LOGE(TAG, "Failed to allocate %d RMT items", num_items);
            return;
        }
        heap_alloc = true;
    }

    ws2812_build_items(items, num_items, s_buffer, num_bytes);

    esp_err_t err = pal_rmt_write_items(RMT_CHANNEL, items, num_items, true);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "RMT write failed: %s", esp_err_to_name(err));
    }

    if (heap_alloc) free(items);
}

/* ── Driver vtable ─────────────────────────────────────────────────── */

static drv_err_t ws2812b_init(const driver_config_t *cfg) {
    if (!cfg || cfg->gpio == DRV_GPIO_NONE ||
        cfg->channels == 0 || cfg->channels > WS2812_MAX_LEDS) {
        return DRV_ERR_ARG;
    }

    s_gpio      = cfg->gpio;
    s_led_count = cfg->channels;
    memset(s_buffer, 0, sizeof(s_buffer));

    /* 24 bits per LED × 8 RMT items per bit + 1 reset item */
    size_t mem_blocks = (size_t)s_led_count * 24 + 1;

    esp_err_t err = pal_rmt_init_tx(RMT_CHANNEL, s_gpio,
                                     RMT_RESOLUTION_HZ, mem_blocks);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "RMT init failed");
        return DRV_ERR_INTERNAL;
    }

    s_ready = true;
    ESP_LOGI(TAG, "WS2812B %u LEDs on GPIO %u", s_led_count, s_gpio);
    return DRV_OK;
}

static drv_err_t ws2812b_read(driver_value_t *values, uint8_t *count) {
    if (!s_ready || !values || !count) return DRV_ERR_STATE;
    strncpy(values[0].key, "led_count", 31);
    values[0].type = DRV_VAL_NUMBER;
    values[0].number_value = s_led_count;
    *count = 1;
    return DRV_OK;
}

static drv_err_t ws2812b_command(const char *action, const void *arg) {
    if (!s_ready || !action || !arg) return DRV_ERR_STATE;
    const cJSON *root = (const cJSON *)arg;

    if (strcmp(action, "ws2812b_fill") == 0) {
        cJSON *j_r = cJSON_GetObjectItem(root, "r");
        cJSON *j_g = cJSON_GetObjectItem(root, "g");
        cJSON *j_b = cJSON_GetObjectItem(root, "b");
        if (!cJSON_IsNumber(j_r) || !cJSON_IsNumber(j_g) || !cJSON_IsNumber(j_b)) {
            return DRV_ERR_ARG;
        }
        uint8_t r = (uint8_t)j_r->valueint;
        uint8_t g = (uint8_t)j_g->valueint;
        uint8_t b = (uint8_t)j_b->valueint;

        for (int i = 0; i < s_led_count; i++) {
            s_buffer[i * 3 + WS2812_COLOR_ORDER_G] = g;
            s_buffer[i * 3 + WS2812_COLOR_ORDER_R] = r;
            s_buffer[i * 3 + WS2812_COLOR_ORDER_B] = b;
        }
        ws2812_flush();
        return DRV_OK;
    }

    if (strcmp(action, "ws2812b_set") == 0) {
        cJSON *j_idx = cJSON_GetObjectItem(root, "index");
        cJSON *j_r   = cJSON_GetObjectItem(root, "r");
        cJSON *j_g   = cJSON_GetObjectItem(root, "g");
        cJSON *j_b   = cJSON_GetObjectItem(root, "b");
        if (!cJSON_IsNumber(j_idx) || j_idx->valueint < 0 ||
            j_idx->valueint >= s_led_count) return DRV_ERR_ARG;
        if (!cJSON_IsNumber(j_r) || !cJSON_IsNumber(j_g) || !cJSON_IsNumber(j_b)) {
            return DRV_ERR_ARG;
        }
        int i = j_idx->valueint;
        s_buffer[i * 3 + WS2812_COLOR_ORDER_G] = (uint8_t)j_g->valueint;
        s_buffer[i * 3 + WS2812_COLOR_ORDER_R] = (uint8_t)j_r->valueint;
        s_buffer[i * 3 + WS2812_COLOR_ORDER_B] = (uint8_t)j_b->valueint;
        ws2812_flush();
        return DRV_OK;
    }

    if (strcmp(action, "ws2812b_clear") == 0) {
        memset(s_buffer, 0, sizeof(s_buffer));
        ws2812_flush();
        return DRV_OK;
    }

    return DRV_ERR_NOT_SUPP;
}

static drv_err_t ws2812b_deinit(void) {
    s_ready = false;
    pal_rmt_deinit_tx(RMT_CHANNEL);
    return DRV_OK;
}

const driver_t drv_ws2812b = {
    .name    = "WS2812B",
    .init    = ws2812b_init,
    .read    = ws2812b_read,
    .command = ws2812b_command,
    .deinit  = ws2812b_deinit,
};
IO_DRIVER_REGISTER(drv_ws2812b);
