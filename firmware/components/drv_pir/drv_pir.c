/** @file drv_pir.c — PIR motion sensor (GPIO digital input). */
#include "drv_pir.h"
#include "pal_gpio.h"
#include "esp_log.h"
#include <string.h>
static const char *TAG = "drv_pir";
static uint8_t s_gpio = DRV_GPIO_NONE;
static bool s_ready = false;

static drv_err_t pir_init(const driver_config_t *cfg) {
    if(!cfg||cfg->gpio==DRV_GPIO_NONE) return DRV_ERR_ARG;
    s_gpio=cfg->gpio;
    esp_err_t err=pal_gpio_set_direction(s_gpio,PAL_GPIO_INPUT);
    if(err!=ESP_OK) return DRV_ERR_INTERNAL;
    s_ready=true;
    ESP_LOGI(TAG,"PIR initialized on GPIO %u",s_gpio);
    return DRV_OK;
}
static drv_err_t pir_read(driver_value_t *values, uint8_t *count) {
    if(!s_ready||!values||!count) return DRV_ERR_STATE;
    uint8_t level;
    pal_gpio_get_level(s_gpio,&level);
    strncpy(values[0].key,"motion",31);
    values[0].type=DRV_VAL_BOOL;
    values[0].bool_value=(level==1);
    *count=1;
    return DRV_OK;
}
static drv_err_t pir_command(const char *action, const void *arg) { (void)action;(void)arg; return DRV_ERR_NOT_SUPP; }
static drv_err_t pir_deinit(void) { s_ready=false; return DRV_OK; }

const driver_t drv_pir = { .name="PIR", .init=pir_init, .read=pir_read, .command=pir_command, .deinit=pir_deinit };
IO_DRIVER_REGISTER(drv_pir);
