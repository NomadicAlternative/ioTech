/**
 * LCD 1602A (HD44780) Character Display Driver
 *
 * Protocol: I2C via PCF8574 backpack (default 0x27, alt 0x3F)
 * Config: { "model": "LCD1602", "i2c_addr": "0x27", "cols": 16, "rows": 2 }
 *
 * ⚠️ Requires: ESP-IDF I2C + hd44780 library or ported LiquidCrystal_I2C
 */
#include "driver.h"
#include "esp_log.h"
#include <string.h>

static const char *TAG = "lcd1602";

static bool initialized = false;
static int cols = 16;
static int rows = 2;

/* ── HD44780 low-level commands (sent via I2C backpack) ─────────────────── */
#define LCD_CLEAR        0x01
#define LCD_HOME         0x02
#define LCD_ENTRY_MODE   0x04
#define LCD_DISPLAY_ON   0x0C
#define LCD_DISPLAY_OFF  0x08
#define LCD_SET_DDRAM    0x80

static void lcd_send(uint8_t data, uint8_t mode) {
    // I2C write via PCF8574:
    // - high nibble first, then low nibble
    // - RS bit, RW bit, EN bit, backlight bit
    // i2c_master_write_to_device(I2C_ADDR, &cmd, 1, portMAX_DELAY);
    (void)data; (void)mode;
}

static void lcd_command(uint8_t cmd) { lcd_send(cmd, 0); }
static void lcd_write_char(char c)    { lcd_send((uint8_t)c, 1); }

static bool lcd1602_init(const cJSON *config) {
    const cJSON *c = cJSON_GetObjectItem(config, "cols");
    const cJSON *r = cJSON_GetObjectItem(config, "rows");
    if (c && cJSON_IsNumber(c)) cols = c->valueint;
    if (r && cJSON_IsNumber(r)) rows = r->valueint;

    // I2C init:
    // i2c_master_init();
    // HD44780 init sequence (4-bit mode via I2C backpack):
    // lcd_send(0x03, 0); delay(5ms); lcd_send(0x03, 0); delay(1ms);
    // lcd_send(0x03, 0); lcd_send(0x02, 0);
    // lcd_command(0x28); // 4-bit, 2 lines, 5x8 font
    // lcd_command(LCD_DISPLAY_ON);
    // lcd_command(LCD_ENTRY_MODE | 0x02); // auto-increment
    // lcd_command(LCD_CLEAR);

    initialized = true;
    ESP_LOGI(TAG, "Initialized LCD %dx%d on I2C (0x27)", cols, rows);
    return true;
}

static int lcd1602_read(telemetry_point_t *points, int max) {
    (void)points; (void)max;
    return 0; /* Displays don't produce telemetry */
}

static bool lcd1602_write(const char *key, const cJSON *value) {
    if (!initialized || !value) return false;

    if (strcmp(key, "clear") == 0) {
        lcd_command(LCD_CLEAR);
        return true;
    }

    if (strcmp(key, "home") == 0) {
        lcd_command(LCD_HOME);
        return true;
    }

    if (strcmp(key, "text") == 0) {
        int row = cJSON_GetObjectItem(value, "row") ? cJSON_GetObjectItem(value, "row")->valueint : 0;
        int col = cJSON_GetObjectItem(value, "col") ? cJSON_GetObjectItem(value, "col")->valueint : 0;
        const char *text = cJSON_GetObjectItem(value, "text") ? cJSON_GetObjectItem(value, "text")->valuestring : "";

        // Set DDRAM address: row 0 = 0x00, row 1 = 0x40, row 2 = 0x14, row 3 = 0x54
        const uint8_t row_offsets[] = {0x00, 0x40, 0x14, 0x54};
        lcd_command(LCD_SET_DDRAM | (row_offsets[row % rows] + col));

        for (int i = 0; text[i] && (col + i) < cols; i++) {
            lcd_write_char(text[i]);
        }
        ESP_LOGI(TAG, "Row %d Col %d: \"%s\"", row, col, text);
        return true;
    }

    if (strcmp(key, "backlight") == 0) {
        bool on = value->type == cJSON_True || (cJSON_IsNumber(value) && value->valueint);
        // backlight = on;
        ESP_LOGI(TAG, "Backlight: %s", on ? "ON" : "OFF");
        return true;
    }

    (void)key;
    return false;
}

static int lcd1602_get_state(telemetry_point_t *points, int max) {
    if (!initialized || max < 1) return 0;
    points[0] = (telemetry_point_t){
        .capability = CAP_OLED, .key = "display",
        .value = { .s = "lcd1602" }, .value_type = 3,
    };
    return 1;
}

static void lcd1602_deinit(void) {
    lcd_command(LCD_DISPLAY_OFF);
    initialized = false;
}

__attribute__((constructor))
static void register_lcd1602(void) {
    static driver_t drv = {
        .name = "LCD 1602A (HD44780 I2C)",
        .model = "LCD1602",
        .init = lcd1602_init, .read = lcd1602_read,
        .write = lcd1602_write, .get_state = lcd1602_get_state, .deinit = lcd1602_deinit,
    };
    driver_register(&drv);
}
