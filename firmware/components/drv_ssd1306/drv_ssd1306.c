/** @file drv_ssd1306.c — SSD1306 128x64 OLED display driver (I2C). */
#include "drv_ssd1306.h"
#include "pal_i2c.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>
static const char *TAG = "drv_ssd1306";
#define SSD1306_ADDR 0x3C
#define SSD1306_WIDTH 128
#define SSD1306_HEIGHT 64
static uint8_t s_sda=0,s_scl=0;
static uint8_t s_fb[SSD1306_WIDTH*(SSD1306_HEIGHT/8)];
static bool s_ready=false;

static void ssd1306_send_cmd(uint8_t cmd) {
    const uint8_t buf[2]={0x00,cmd};
    pal_i2c_master_write(SSD1306_ADDR,buf,2);
}
static drv_err_t ssd1306_init(const driver_config_t *cfg) {
    if(!cfg||cfg->i2c_sda==0||cfg->i2c_scl==0) return DRV_ERR_ARG;
    s_sda=cfg->i2c_sda; s_scl=cfg->i2c_scl;
    pal_i2c_master_init(s_sda,s_scl,400000);
    memset(s_fb,0,sizeof(s_fb));
    /* Init sequence */
    ssd1306_send_cmd(0xAE); /* display off */
    ssd1306_send_cmd(0xD5); ssd1306_send_cmd(0x80); /* clock */
    ssd1306_send_cmd(0xA8); ssd1306_send_cmd(63); /* mux */
    ssd1306_send_cmd(0xD3); ssd1306_send_cmd(0x00); /* offset */
    ssd1306_send_cmd(0x40); /* start line */
    ssd1306_send_cmd(0x8D); ssd1306_send_cmd(0x14); /* charge pump */
    ssd1306_send_cmd(0x20); ssd1306_send_cmd(0x00); /* memory mode */
    ssd1306_send_cmd(0xA1); /* seg remap */
    ssd1306_send_cmd(0xC8); /* COM scan dir */
    ssd1306_send_cmd(0xDA); ssd1306_send_cmd(0x12); /* COM pins */
    ssd1306_send_cmd(0x81); ssd1306_send_cmd(0xCF); /* contrast */
    ssd1306_send_cmd(0xD9); ssd1306_send_cmd(0xF1); /* pre-charge */
    ssd1306_send_cmd(0xDB); ssd1306_send_cmd(0x40); /* VCOMH */
    ssd1306_send_cmd(0xA4); /* resume */
    ssd1306_send_cmd(0xA6); /* normal display */
    ssd1306_send_cmd(0xAF); /* display ON */
    s_ready=true;
    ESP_LOGI(TAG,"SSD1306 initialized SDA=%u SCL=%u",s_sda,s_scl);
    return DRV_OK;
}
static drv_err_t ssd1306_read(driver_value_t *values, uint8_t *count) {
    if(!s_ready||!values||!count) return DRV_ERR_STATE;
    strncpy(values[0].key,"display_on",31);
    values[0].type=DRV_VAL_BOOL; values[0].bool_value=s_ready;
    *count=1;
    return DRV_OK;
}
static drv_err_t ssd1306_command(const char *action, const void *arg) {
    if(!s_ready||!action||!arg) return DRV_ERR_STATE;
    const cJSON *root=(const cJSON*)arg;
    if(strcmp(action,"ssd1306_clear")==0) { memset(s_fb,0,sizeof(s_fb)); return DRV_OK; }
    if(strcmp(action,"ssd1306_text")==0) {
        /* Text rendering placeholder */
        return DRV_OK;
    }
    return DRV_ERR_NOT_SUPP;
}
static drv_err_t ssd1306_deinit(void) { ssd1306_send_cmd(0xAE); s_ready=false; return DRV_OK; }

const driver_t drv_ssd1306 = { .name="SSD1306", .init=ssd1306_init, .read=ssd1306_read, .command=ssd1306_command, .deinit=ssd1306_deinit };
IO_DRIVER_REGISTER(drv_ssd1306);
