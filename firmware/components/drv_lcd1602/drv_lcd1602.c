/**
 * @file drv_lcd1602.c
 * @brief LCD1602 16x2 character display driver — I2C via PCF8574 backpack.
 *
 * Typical I2C backpacks use a PCF8574 I/O expander wired to the HD44780
 * in 4-bit mode:
 *
 *   PCF8574 | LCD
 *   --------|-----
 *   P0      | RS
 *   P1      | RW
 *   P2      | EN
 *   P3      | Backlight
 *   P4      | D4
 *   P5      | D5
 *   P6      | D6
 *   P7      | D7
 *
 * I2C addresses: 0x27 (most common) or 0x3F (some modules).
 * Selectable via driver_config_t.i2c_addr — defaults to 0x27.
 *
 * Commands:
 *   lcd1602_text     — write text (JSON: { "text": "Hello", "line": 0 })
 *   lcd1602_clear    — clear display
 *   lcd1602_cursor   — set cursor (JSON: { "col": 0, "row": 0 })
 *   lcd1602_backlight — backlight on/off (JSON: { "on": true })
 */
#include "drv_lcd1602.h"
#include "pal_i2c.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "drv_lcd1602";

/* ── PCF8574 pin mapping ──────────────────────────────────────────── */
#define LCD_RS   (1 << 0)
#define LCD_RW   (1 << 1)
#define LCD_EN   (1 << 2)
#define LCD_BL   (1 << 3)  /* Backlight */
#define LCD_D4   (1 << 4)
#define LCD_D5   (1 << 5)
#define LCD_D6   (1 << 6)
#define LCD_D7   (1 << 7)

/* ── HD44780 commands ──────────────────────────────────────────────── */
#define LCD_CLEAR        0x01
#define LCD_HOME         0x02
#define LCD_ENTRY_MODE   0x04
#define LCD_DISPLAY_ON   0x0C  /* Display ON, cursor OFF, blink OFF */
#define LCD_FUNCTION_SET 0x28  /* 4-bit, 2 lines, 5x8 dots */
#define LCD_SET_DDRAM    0x80  /* + address */

#define LCD_LINE1_ADDR   0x00
#define LCD_LINE2_ADDR   0x40

/* ── Driver state ──────────────────────────────────────────────────── */
static uint8_t  s_addr   = 0x27;   /* I2C address (0x27 or 0x3F) */
static uint8_t  s_sda    = 0;
static uint8_t  s_scl    = 0;
static bool     s_bl     = true;   /* Backlight ON by default */
static bool     s_ready  = false;

/* ── Low-level I2C helpers ─────────────────────────────────────────── */

/**
 * Send a byte to the PCF8574 with backlight state preserved.
 * The EN pulse + data latching is handled by send_nibble().
 */
static void pcf8574_write(uint8_t data) {
    uint8_t buf[1] = { data | (s_bl ? LCD_BL : 0) };
    pal_i2c_master_write(s_addr, buf, 1);
}

/**
 * Send a nibble (4 bits) with EN pulse. The upper 4 bits of `data`
 * are placed on D4-D7 before the EN strobe.
 */
static void send_nibble(uint8_t data) {
    /* Set data on D4-D7 lines, bring EN high */
    pcf8574_write(data | LCD_EN);
    /* Hold EN for ~1µs — the I2C write itself provides sufficient delay at 100kHz */
    /* EN low latches the data */
    pcf8574_write(data & ~LCD_EN);
}

/**
 * Send a full byte (two nibbles, high nibble first).
 * `rs` is LCD_RS for data or 0 for command.
 */
static void send_byte(uint8_t data, uint8_t rs) {
    uint8_t hi = (data & 0xF0) | rs;
    uint8_t lo = ((data << 4) & 0xF0) | rs;

    send_nibble(hi);
    send_nibble(lo);
}

/* ── HD44780 commands ──────────────────────────────────────────────── */

static void lcd_command(uint8_t cmd) {
    send_byte(cmd, 0); /* RS = 0 for command */
}

static void lcd_data(uint8_t data) {
    send_byte(data, LCD_RS); /* RS = 1 for data */
}

static void lcd_clear(void) {
    lcd_command(LCD_CLEAR);
    /* Clear takes ~1.5ms. The I2C writes + PAL delay provide enough time. */
}

static void lcd_set_cursor(uint8_t col, uint8_t row) {
    uint8_t addr = (row == 0) ? LCD_LINE1_ADDR : LCD_LINE2_ADDR;
    lcd_command(LCD_SET_DDRAM | (addr + col));
}

static void lcd_print(const char *str) {
    while (*str) {
        lcd_data((uint8_t)*str);
        str++;
    }
}

/* ── io_driver interface ───────────────────────────────────────────── */

static drv_err_t lcd1602_init(const driver_config_t *cfg) {
    if (!cfg || cfg->i2c_sda == 0 || cfg->i2c_scl == 0) {
        ESP_LOGE(TAG, "Invalid config: SDA/SCL required");
        return DRV_ERR_ARG;
    }

    s_sda  = cfg->i2c_sda;
    s_scl  = cfg->i2c_scl;
    s_addr = cfg->i2c_addr ? (uint8_t)cfg->i2c_addr : 0x27;

    pal_i2c_master_init(s_sda, s_scl, 100000); /* Standard mode: 100kHz */

    /* ── HD44780 4-bit init sequence (as per datasheet) ────────────── */
    /* Wait >15ms after power-up — I2C init provides enough delay */

    /* Step 1: send 0x30 three times (wake-up sequence) */
    send_nibble(0x30);
    vTaskDelay(pdMS_TO_TICKS(5)); /* >4.1ms */
    send_nibble(0x30);
    vTaskDelay(pdMS_TO_TICKS(1)); /* >100µs */
    send_nibble(0x30);
    vTaskDelay(pdMS_TO_TICKS(1));

    /* Step 2: set 4-bit mode */
    send_nibble(0x20); /* 4-bit mode */

    /* Step 3: function set — 4-bit, 2 lines, 5x8 dots */
    lcd_command(LCD_FUNCTION_SET);

    /* Step 4: display ON, cursor OFF, blink OFF */
    lcd_command(LCD_DISPLAY_ON);

    /* Step 5: clear display */
    lcd_clear();

    /* Step 6: entry mode — increment cursor, no shift */
    lcd_command(LCD_ENTRY_MODE | 0x02);

    /* Backlight ON */
    s_bl = true;
    pcf8574_write(0x00); /* all data low, backlight on */

    s_ready = true;
    ESP_LOGI(TAG, "LCD1602 initialized SDA=%u SCL=%u addr=0x%02X", s_sda, s_scl, s_addr);
    return DRV_OK;
}

static drv_err_t lcd1602_read(driver_value_t *values, uint8_t *count) {
    if (!s_ready || !values || !count) return DRV_ERR_STATE;

    /* Display has no sensor readings — report readiness */
    strncpy(values[0].key, "display_on", 31);
    values[0].type        = DRV_VAL_BOOL;
    values[0].bool_value  = s_ready;
    *count = 1;
    return DRV_OK;
}

static drv_err_t lcd1602_command(const char *action, const void *arg) {
    if (!s_ready || !action || !arg) return DRV_ERR_STATE;

    const cJSON *root = (const cJSON *)arg;

    if (strcmp(action, "lcd1602_clear") == 0) {
        lcd_clear();
        return DRV_OK;
    }

    if (strcmp(action, "lcd1602_text") == 0) {
        const cJSON *text_json = cJSON_GetObjectItem(root, "text");
        const cJSON *line_json = cJSON_GetObjectItem(root, "line");

        if (!text_json || !cJSON_IsString(text_json)) {
            ESP_LOGW(TAG, "lcd1602_text: 'text' (string) required");
            return DRV_ERR_ARG;
        }

        uint8_t line = 0;
        if (line_json && cJSON_IsNumber(line_json)) {
            line = (uint8_t)line_json->valueint;
            if (line > 1) line = 1; /* Clamp to 2 lines */
        }

        lcd_set_cursor(0, line);

        /* Pad or truncate to 16 chars */
        const char *raw = text_json->valuestring;
        char buf[17];
        strncpy(buf, raw, 16);
        buf[16] = '\0';

        /* Pad with spaces to clear previous content on this line */
        size_t len = strlen(buf);
        while (len < 16) buf[len++] = ' ';
        buf[16] = '\0';

        lcd_print(buf);
        return DRV_OK;
    }

    if (strcmp(action, "lcd1602_cursor") == 0) {
        const cJSON *col_json = cJSON_GetObjectItem(root, "col");
        const cJSON *row_json = cJSON_GetObjectItem(root, "row");

        if (!col_json || !row_json || !cJSON_IsNumber(col_json) || !cJSON_IsNumber(row_json)) {
            ESP_LOGW(TAG, "lcd1602_cursor: 'col' and 'row' (numbers) required");
            return DRV_ERR_ARG;
        }

        uint8_t col = (uint8_t)col_json->valueint;
        uint8_t row = (uint8_t)row_json->valueint;
        if (col > 15) col = 15;
        if (row > 1)  row = 1;

        lcd_set_cursor(col, row);
        return DRV_OK;
    }

    if (strcmp(action, "lcd1602_backlight") == 0) {
        const cJSON *on_json = cJSON_GetObjectItem(root, "on");

        if (!on_json || !cJSON_IsBool(on_json)) {
            ESP_LOGW(TAG, "lcd1602_backlight: 'on' (bool) required");
            return DRV_ERR_ARG;
        }

        s_bl = cJSON_IsTrue(on_json);
        pcf8574_write(0x00); /* Refresh backlight state */
        return DRV_OK;
    }

    return DRV_ERR_NOT_SUPP;
}

static drv_err_t lcd1602_deinit(void) {
    lcd_clear();
    lcd_command(LCD_DISPLAY_ON & ~0x04); /* Display OFF */
    s_bl    = false;
    s_ready = false;
    pcf8574_write(0x00);
    ESP_LOGI(TAG, "LCD1602 deinitialized");
    return DRV_OK;
}

/* ── Driver registration ───────────────────────────────────────────── */

const driver_t drv_lcd1602 = {
    .name    = "LCD1602",
    .init    = lcd1602_init,
    .read    = lcd1602_read,
    .command = lcd1602_command,
    .deinit  = lcd1602_deinit,
};

IO_DRIVER_REGISTER(drv_lcd1602);
