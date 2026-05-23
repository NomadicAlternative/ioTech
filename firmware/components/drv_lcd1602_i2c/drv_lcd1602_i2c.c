/**
 * @file drv_lcd1602_i2c.c
 * @brief LCD 1602A I2C (PCF8574 backpack) — 16×2 character display.
 *
 * Protocol: I2C 4-bit mode via PCF8574.
 * Default address: 0x27 (alt: 0x3F).
 *
 * Commands via MQTT:
 *   {"text": "Hola", "row": 0, "col": 0}
 *   {"clear": true}
 *   {"backlight": true}
 */
#include "drv_lcd1602_i2c.h"
#include "driver/i2c.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>

static const char *TAG = "drv_lcd1602_i2c";

#define I2C_MASTER_NUM   I2C_NUM_0
#define I2C_MASTER_FREQ   100000
#define LCD_ADDR          0x27
#define LCD_COLS          16
#define LCD_ROWS          2

/* HD44780 commands */
#define LCD_CLEAR      0x01
#define LCD_HOME       0x02
#define LCD_ENTRY_MODE 0x06  /* auto-increment, no shift */
#define LCD_DISPLAY_ON 0x0C  /* display on, cursor off, blink off */
#define LCD_FUNCTION   0x28  /* 4-bit, 2 lines, 5x8 font */
#define LCD_SET_DDRAM  0x80

/* PCF8574 pin mapping for LCD (4-bit mode) */
#define LCD_BACKLIGHT  0x08
#define LCD_ENABLE     0x04
#define LCD_RW         0x02  /* always 0 (write) */
#define LCD_RS         0x01  /* 0=cmd, 1=data */

static uint8_t s_sda, s_scl;
static bool s_ready = false;
static char s_buffer[LCD_ROWS][LCD_COLS + 1];

/* ── I2C helpers ─────────────────────────────────────────────────────── */

static esp_err_t i2c_write(uint8_t data)
{
    i2c_cmd_handle_t cmd = i2c_cmd_link_create();
    i2c_master_start(cmd);
    i2c_master_write_byte(cmd, (LCD_ADDR << 1) | I2C_MASTER_WRITE, true);
    i2c_master_write_byte(cmd, data, true);
    i2c_master_stop(cmd);
    esp_err_t ret = i2c_master_cmd_begin(I2C_MASTER_NUM, cmd, pdMS_TO_TICKS(10));
    i2c_cmd_link_delete(cmd);
    return ret;
}

/* Pulse EN: send nibble with EN=1, then EN=0 */
static void lcd_pulse(uint8_t nibble)
{
    uint8_t data = nibble | LCD_BACKLIGHT | LCD_ENABLE;
    i2c_write(data);
    data &= ~LCD_ENABLE;
    i2c_write(data);
}

/* Send a byte as two nibbles (4-bit mode) */
static void lcd_send(uint8_t byte, uint8_t rs)
{
    uint8_t hi = (byte & 0xF0) | (rs ? LCD_RS : 0);
    uint8_t lo = ((byte << 4) & 0xF0) | (rs ? LCD_RS : 0);
    lcd_pulse(hi);
    lcd_pulse(lo);
}

static void lcd_cmd(uint8_t cmd)  { lcd_send(cmd, 0); }
static void lcd_data(uint8_t data) { lcd_send(data, 1); }

/* ── io_driver vtable ─────────────────────────────────────────────────── */

static drv_err_t lcd1602_i2c_init(const driver_config_t *cfg)
{
    if (!cfg) return DRV_ERR_ARG;
    s_sda = cfg->i2c_sda ? cfg->i2c_sda : 21;
    s_scl = cfg->i2c_scl ? cfg->i2c_scl : 22;

    i2c_config_t conf = {
        .mode = I2C_MODE_MASTER,
        .sda_io_num = s_sda,
        .scl_io_num = s_scl,
        .sda_pullup_en = GPIO_PULLUP_ENABLE,
        .scl_pullup_en = GPIO_PULLUP_ENABLE,
        .master.clk_speed = I2C_MASTER_FREQ,
    };
    if (i2c_param_config(I2C_MASTER_NUM, &conf) != ESP_OK ||
        i2c_driver_install(I2C_MASTER_NUM, conf.mode, 0, 0, 0) != ESP_OK) {
        ESP_LOGE(TAG, "I2C init failed");
        return DRV_ERR_BUS;
    }

    /* HD44780 init sequence (4-bit mode) */
    lcd_pulse(0x30);  /* Wake up */
    lcd_pulse(0x30);
    lcd_pulse(0x30);
    lcd_pulse(0x20);  /* Switch to 4-bit */
    lcd_cmd(LCD_FUNCTION);
    lcd_cmd(LCD_DISPLAY_ON);
    lcd_cmd(LCD_CLEAR);
    lcd_cmd(LCD_ENTRY_MODE);

    memset(s_buffer, ' ', sizeof(s_buffer));
    for (int r = 0; r < LCD_ROWS; r++) s_buffer[r][LCD_COLS] = '\0';
    s_ready = true;

    ESP_LOGI(TAG, "LCD1602 initialized I2C addr=0x%02X SDA=%u SCL=%u", LCD_ADDR, s_sda, s_scl);
    return DRV_OK;
}

static drv_err_t lcd1602_i2c_read(driver_value_t *values, uint8_t *count)
{
    /* Display doesn't produce telemetry — return line 0 content as state */
    if (!s_ready || !values || !count) return DRV_ERR_STATE;
    *count = 1;
    strncpy(values[0].key, "line0", sizeof(values[0].key));
    values[0].type = DRV_VAL_STRING;
    strncpy(values[0].string_value, s_buffer[0], sizeof(values[0].string_value));
    return DRV_OK;
}

static drv_err_t lcd1602_i2c_command(const char *action, const void *arg)
{
    if (!s_ready || !action) return DRV_ERR_STATE;
    const cJSON *json = (const cJSON *)arg;

    if (strcmp(action, "clear") == 0 || cJSON_IsTrue(cJSON_GetObjectItem(json, "clear"))) {
        lcd_cmd(LCD_CLEAR);
        memset(s_buffer, ' ', sizeof(s_buffer));
        return DRV_OK;
    }

    const cJSON *text = cJSON_GetObjectItem(json, "text");
    if (text && cJSON_IsString(text)) {
        int row = 0, col = 0;
        const cJSON *r = cJSON_GetObjectItem(json, "row");
        const cJSON *c = cJSON_GetObjectItem(json, "col");
        if (cJSON_IsNumber(r)) row = r->valueint;
        if (cJSON_IsNumber(c)) col = c->valueint;
        if (row >= LCD_ROWS) row = LCD_ROWS - 1;

        /* Set cursor position */
        const uint8_t row_offsets[] = {0x00, 0x40};
        lcd_cmd(LCD_SET_DDRAM | (row_offsets[row] + col));

        const char *str = text->valuestring;
        for (int i = 0; str[i] && (col + i) < LCD_COLS; i++) {
            lcd_data((uint8_t)str[i]);
            s_buffer[row][col + i] = str[i];
        }
        return DRV_OK;
    }

    const cJSON *bl = cJSON_GetObjectItem(json, "backlight");
    if (bl) {
        uint8_t data = cJSON_IsTrue(bl) ? LCD_BACKLIGHT : 0;
        i2c_write(data);
        return DRV_OK;
    }

    (void)action;
    return DRV_ERR_NOT_SUPP;
}

static drv_err_t lcd1602_i2c_deinit(void)
{
    lcd_cmd(LCD_DISPLAY_ON ^ 0x04); /* display off */
    i2c_driver_delete(I2C_MASTER_NUM);
    s_ready = false;
    return DRV_OK;
}

/* ── Auto-register ────────────────────────────────────────────────────── */

static driver_t drv_lcd1602_i2c = {
    .name    = "LCD1602_I2C",
    .init    = lcd1602_i2c_init,
    .read    = lcd1602_i2c_read,
    .command = lcd1602_i2c_command,
    .deinit  = lcd1602_i2c_deinit,
};

IO_DRIVER_REGISTER(drv_lcd1602_i2c);
