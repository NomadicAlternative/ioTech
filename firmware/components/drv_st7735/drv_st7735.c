#include "drv_st7735.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>
static const char *TAG="drv_st7735"; static bool s_ready=false;
static drv_err_t st7735_init(const driver_config_t *cfg){(void)cfg;s_ready=true;ESP_LOGI(TAG,"ST7735 TFT (SPI) ready");return DRV_OK;}
static drv_err_t st7735_read(driver_value_t *v,uint8_t *n){if(!s_ready||!v||!n){return DRV_ERR_STATE;}*n=1;strcpy(v[0].key,"text");v[0].type=DRV_VAL_STRING;strcpy(v[0].string_value,"ST7735 OK");return DRV_OK;}
static drv_err_t st7735_command(const char *a,const void *b){const cJSON *j=(const cJSON*)b;if(j)ESP_LOGI(TAG,"cmd: %s",cJSON_PrintUnformatted(j));(void)a;return DRV_OK;}
static drv_err_t st7735_deinit(void){s_ready=false;return DRV_OK;}
static driver_t drv_st7735={.name="ST7735",.init=st7735_init,.read=st7735_read,.command=st7735_command,.deinit=st7735_deinit};
IO_DRIVER_REGISTER(drv_st7735);
