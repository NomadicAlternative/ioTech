/** @file drv_ds18b20.c — DS18B20 1-wire temperature sensor. */
#include "drv_ds18b20.h"
#include "pal_gpio.h"
#include "pal_delay.h"
#include "esp_log.h"
#include <string.h>
static const char *TAG = "drv_ds18b20";
static uint8_t s_gpio = DRV_GPIO_NONE;
static bool s_ready = false;

static bool onewire_reset(void) {
    uint8_t level;
    pal_gpio_set_direction(s_gpio, PAL_GPIO_OUTPUT);
    pal_gpio_set_level(s_gpio, 0); pal_delay_us(480);
    pal_gpio_set_direction(s_gpio, PAL_GPIO_INPUT);
    pal_delay_us(70);
    pal_gpio_get_level(s_gpio, &level);
    pal_delay_us(410);
    return (level == 0);
}
static void onewire_write_bit(bool bit) {
    pal_gpio_set_direction(s_gpio, PAL_GPIO_OUTPUT);
    pal_gpio_set_level(s_gpio, 0); pal_delay_us(bit ? 1 : 60);
    pal_gpio_set_direction(s_gpio, PAL_GPIO_INPUT);
    if (bit) pal_delay_us(60);
}
static bool onewire_read_bit(void) {
    uint8_t level;
    pal_gpio_set_direction(s_gpio, PAL_GPIO_OUTPUT);
    pal_gpio_set_level(s_gpio, 0); pal_delay_us(1);
    pal_gpio_set_direction(s_gpio, PAL_GPIO_INPUT);
    pal_delay_us(14);
    pal_gpio_get_level(s_gpio, &level);
    pal_delay_us(45);
    return (level == 1);
}
static void onewire_write_byte(uint8_t b) { for (int i=0;i<8;i++) { onewire_write_bit(b & 1); b >>= 1; } }
static uint8_t onewire_read_byte(void) { uint8_t b=0; for(int i=0;i<8;i++) if(onewire_read_bit()) b|=(1<<i); return b; }
static uint8_t crc8(const uint8_t *d, int n) { uint8_t c=0; while(n--){uint8_t x=c^*d++;for(int i=0;i<8;i++)x=(x>>1)^((x&1)?0x8C:0);c=x;}return c;}

static drv_err_t ds18b20_init(const driver_config_t *cfg) {
    if(!cfg||cfg->gpio==DRV_GPIO_NONE) return DRV_ERR_ARG;
    s_gpio=cfg->gpio; s_ready=true;
    pal_gpio_set_direction(s_gpio,PAL_GPIO_INPUT);
    return DRV_OK;
}
static drv_err_t ds18b20_read(driver_value_t *values, uint8_t *count) {
    if(!s_ready||!values||!count) return DRV_ERR_STATE;
    *count=0;
    if(!onewire_reset()) { ESP_LOGE(TAG,"No presence"); return DRV_ERR_TIMEOUT; }
    onewire_write_byte(0xCC); /* skip ROM */
    onewire_write_byte(0x44); /* convert T */
    pal_delay_ms(750);
    if(!onewire_reset()) return DRV_ERR_TIMEOUT;
    onewire_write_byte(0xCC);
    onewire_write_byte(0xBE); /* read scratchpad */
    uint8_t data[9];
    for(int i=0;i<9;i++) data[i]=onewire_read_byte();
    if(crc8(data,8)!=data[8]) { ESP_LOGE(TAG,"CRC fail"); return DRV_ERR_CHECKSUM; }
    int16_t raw = ((int16_t)data[1]<<8)|data[0];
    double temp = raw/16.0;
    strncpy(values[0].key,"temperature",31); values[0].type=DRV_VAL_NUMBER; values[0].number_value=temp;
    *count=1;
    return DRV_OK;
}
static drv_err_t ds18b20_command(const char *action, const void *arg) { (void)action;(void)arg; return DRV_ERR_NOT_SUPP; }
static drv_err_t ds18b20_deinit(void) { s_ready=false; return DRV_OK; }

const driver_t drv_ds18b20 = { .name="DS18B20", .init=ds18b20_init, .read=ds18b20_read, .command=ds18b20_command, .deinit=ds18b20_deinit };
IO_DRIVER_REGISTER(drv_ds18b20);
