/*
 * drv_sh1106.c — SH1106 OLED 1.3" 128x64 I2C driver
 *
 * Differences from SSD1306:
 *   - 132-column RAM (visible columns 2–129, offset=2)
 *   - DC-DC control via 0xAD (not 0x8D charge pump)
 *   - Page addressing mode (not horizontal/vertical)
 *   - Different init sequence
 */
#include "drv_sh1106.h"
#include "driver/i2c.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>

static const char *TAG = "drv_sh1106";

#define SH1106_COL_OFFSET  2    /* visible column 0 = RAM column 2 */
#define SH1106_LINES       4
#define SH1106_CHARS        21

static uint8_t  s_addr  = 0x3C;
static bool     s_ready = false;
static char     s_text[SH1106_LINES][SH1106_CHARS + 1];

/* ── send command byte (prefix 0x00) ──────────────────────────── */
static void sh1106_cmd(uint8_t cmd)
{
    uint8_t buf[2] = { 0x00, cmd };
    i2c_master_write_to_device(I2C_NUM_0, s_addr, buf, 2,
                               pdMS_TO_TICKS(10));
}

/* ── send data byte (prefix 0x40) ─────────────────────────────── */
static void sh1106_data(uint8_t data)
{
    uint8_t buf[2] = { 0x40, data };
    i2c_master_write_to_device(I2C_NUM_0, s_addr, buf, 2,
                               pdMS_TO_TICKS(1));
}

/* ── set write position: page + column (with SH1106 offset) ───── */
static void sh1106_set_pos(uint8_t page, uint8_t col)
{
    uint8_t ram_col = col + SH1106_COL_OFFSET;
    sh1106_cmd(0xB0 | page);               /* set page address      */
    sh1106_cmd(0x00 | (ram_col & 0x0F));   /* low column nibble     */
    sh1106_cmd(0x10 | (ram_col >> 4));     /* high column nibble    */
}

/* ── init ─────────────────────────────────────────────────────── */
static drv_err_t sh1106_init(const driver_config_t *cfg)
{
    if (cfg && cfg->i2c_addr) s_addr = cfg->i2c_addr;

    /* configure I2C master */
    i2c_config_t i2c_cfg = {
        .mode             = I2C_MODE_MASTER,
        .sda_io_num       = cfg ? cfg->i2c_sda : 21,
        .scl_io_num       = cfg ? cfg->i2c_scl : 22,
        .sda_pullup_en    = GPIO_PULLUP_ENABLE,
        .scl_pullup_en    = GPIO_PULLUP_ENABLE,
        .master.clk_speed = 400000,
    };
    i2c_param_config(I2C_NUM_0, &i2c_cfg);
    i2c_driver_install(I2C_NUM_0, i2c_cfg.mode, 0, 0, 0);

    /* SH1106 init sequence */
    sh1106_cmd(0xAE);   /* display off                         */
    sh1106_cmd(0x00);   /* set low column = 0                  */
    sh1106_cmd(0x10);   /* set high column = 0                 */
    sh1106_cmd(0x40);   /* set start line = 0                  */
    sh1106_cmd(0xB0);   /* set page = 0                        */
    sh1106_cmd(0x81);   /* contrast control                    */
    sh1106_cmd(0xFF);   /* max contrast                        */
    sh1106_cmd(0xA1);   /* segment remap (SEG0 = col 127)      */
    sh1106_cmd(0xA6);   /* normal display (not inverted)       */
    sh1106_cmd(0xA8);   /* multiplex ratio                     */
    sh1106_cmd(0x3F);   /* 1/64 duty                           */
    sh1106_cmd(0xC8);   /* COM scan direction remapped         */
    sh1106_cmd(0xD3);   /* display offset                      */
    sh1106_cmd(0x00);   /* offset = 0                          */
    sh1106_cmd(0xD5);   /* clock divide / oscillator freq      */
    sh1106_cmd(0x80);   /* divide=1, freq=8                    */
    sh1106_cmd(0xD9);   /* pre-charge period                   */
    sh1106_cmd(0xF1);   /* phase1=1, phase2=15                 */
    sh1106_cmd(0xDA);   /* COM pins hardware config            */
    sh1106_cmd(0x12);   /* alternative, disable remap          */
    sh1106_cmd(0xDB);   /* VCOM deselect level                 */
    sh1106_cmd(0x40);   /* 0.77 x VCC                          */
    sh1106_cmd(0xAD);   /* DC-DC control (SH1106 specific)     */
    sh1106_cmd(0x8A);   /* DC-DC off (external VCC on module)  */
    sh1106_cmd(0xAF);   /* display on                          */

    memset(s_text, ' ', sizeof(s_text));
    for (int i = 0; i < SH1106_LINES; i++)
        s_text[i][SH1106_CHARS] = '\0';

    /* clear screen */
    for (int p = 0; p < 8; p++) {
        sh1106_set_pos(p, 0);
        for (int c = 0; c < 128; c++) sh1106_data(0x00);
    }

    /* splash screen */
    strcpy(s_text[0], "ioTech");
    strcpy(s_text[1], "OLED 1.3\" SH1106");
    strcpy(s_text[2], "GPIO21/22 I2C");
    strcpy(s_text[3], "Ready.");
    for (int ln = 0; ln < 4; ln++) {
        sh1106_set_pos(ln * 2, 0);
        for (const char *p = s_text[ln]; *p; p++)
            sh1106_data((uint8_t)*p);
    }

    s_ready = true;
    ESP_LOGI(TAG, "SH1106 OLED 1.3\" I2C 0x%02X ready", s_addr);
    return DRV_OK;
}

/* ── read (return text buffer as string datastream) ──────────── */
static drv_err_t sh1106_read(driver_value_t *v, uint8_t *n)
{
    if (!s_ready || !v || !n) return DRV_ERR_STATE;
    *n = 1;
    strcpy(v[0].key, "text");
    v[0].type = DRV_VAL_STRING;
    strncpy(v[0].string_value, s_text[0], sizeof(v[0].string_value));
    return DRV_OK;
}

/* ── command: {"text":"...", "line":0} or {"clear":true} ─────── */
static drv_err_t sh1106_command(const char *a, const void *b)
{
    const cJSON *j   = (const cJSON *)b;
    const cJSON *txt = cJSON_GetObjectItem(j, "text");
    const cJSON *cl  = cJSON_GetObjectItem(j, "clear");

    /* clear screen */
    if (cl && cJSON_IsTrue(cl)) {
        memset(s_text, ' ', sizeof(s_text));
        for (int p = 0; p < 8; p++) {
            sh1106_set_pos(p, 0);
            for (int c = 0; c < 128; c++) sh1106_data(0x00);
        }
    }

    /* write text */
    if (txt && cJSON_IsString(txt)) {
        int ln = cJSON_GetObjectItem(j, "line")
                     ? cJSON_GetObjectItem(j, "line")->valueint
                     : 0;
        if (ln >= SH1106_LINES) ln = SH1106_LINES - 1;
        if (ln < 0) ln = 0;

        strncpy(s_text[ln], txt->valuestring, SH1106_CHARS);
        s_text[ln][SH1106_CHARS] = '\0';

        /* render the line (each line = 2 pages on 64px high) */
        uint8_t pg0 = (uint8_t)(ln * 2);
        uint8_t pg1 = (uint8_t)(pg0 + 1);

        for (int pg = pg0; pg <= pg1; pg++) {
            sh1106_set_pos(pg, 0);
            for (int c = 0; c < SH1106_CHARS; c++) {
                /* simple 8x8 font: just write character bytes */
                uint8_t ch = (uint8_t)s_text[ln][c];
                /* page 0 = top half of char, page 1 = bottom half */
                if (ch >= 0x20 && ch <= 0x7E) {
                    /* placeholder — write char directly for now */
                    sh1106_data((pg == pg0) ? ch : 0x00);
                } else {
                    sh1106_data(0x00);
                }
            }
            /* fill rest of line */
            for (int c = SH1106_CHARS; c < 128; c++) sh1106_data(0x00);
        }
    }

    (void)a;
    return DRV_OK;
}

/* ── deinit ──────────────────────────────────────────────────── */
static drv_err_t sh1106_deinit(void)
{
    sh1106_cmd(0xAE);
    s_ready = false;
    return DRV_OK;
}

/* ── driver registration ─────────────────────────────────────── */
static driver_t drv_sh1106 = {
    .name    = "SH1106",
    .init    = sh1106_init,
    .read    = sh1106_read,
    .command = sh1106_command,
    .deinit  = sh1106_deinit,
};
IO_DRIVER_REGISTER(drv_sh1106);
