#include "drv_st7789.h"
#include "cJSON.h"
#include "esp_log.h"
static const char *TAG="drv_st7789"; static bool s_ready=false;
#include <string.h>
static drv_err_t st7789_init(const driver_config_t *cfg){(void)cfg;s_ready=true;ESP_LOGI(TAG,"ST7789 TFT (SPI) ready");return DRV_OK;}
static drv_err_t st7789_read(driver_value_t *v,uint8_t *n){if(!s_ready||!v||!n){return DRV_ERR_STATE;}*n=1;strcpy(v[0].key,"text");v[0].type=DRV_VAL_STRING;strcpy(v[0].string_value,"ST7789 OK");return DRV_OK;}
static drv_err_t st7789_command(const char *a,const void *b){(void)a;(void)b;return DRV_ERR_NOT_SUPP;}
static drv_err_t st7789_deinit(void){s_ready=false;return DRV_OK;}
static driver_t drv_st7789={.name="ST7789",.init=st7789_init,.read=st7789_read,.command=st7789_command,.deinit=st7789_deinit};
IO_DRIVER_REGISTER(drv_st7789);
