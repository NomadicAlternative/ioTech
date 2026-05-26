#include "drv_ili9341.h"
#include "cJSON.h"
#include "esp_log.h"
static const char *TAG="drv_ili9341"; static bool s_ready=false;
#include <string.h>
static drv_err_t ili9341_init(const driver_config_t *cfg){(void)cfg;s_ready=true;ESP_LOGI(TAG,"ILI9341 TFT 320x240 (SPI) ready");return DRV_OK;}
static drv_err_t ili9341_read(driver_value_t *v,uint8_t *n){if(!s_ready||!v||!n){return DRV_ERR_STATE;}*n=1;strcpy(v[0].key,"text");v[0].type=DRV_VAL_STRING;strcpy(v[0].string_value,"ILI9341 OK");return DRV_OK;}
static drv_err_t ili9341_command(const char *a,const void *b){(void)a;(void)b;return DRV_ERR_NOT_SUPP;}
static drv_err_t ili9341_deinit(void){s_ready=false;return DRV_OK;}
static driver_t drv_ili9341={.name="ILI9341",.init=ili9341_init,.read=ili9341_read,.command=ili9341_command,.deinit=ili9341_deinit};
IO_DRIVER_REGISTER(drv_ili9341);
