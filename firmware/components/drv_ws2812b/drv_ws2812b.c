#include "drv_ws2812b.h"
#include "driver/gpio.h"
#include "driver/rmt_tx.h"
#include "cJSON.h"
#include "esp_log.h"
static const char *TAG="drv_ws2812b"; static uint8_t s_gpio=25; static uint8_t s_count=8; static bool s_ready=false;
static drv_err_t ws2812b_init(const driver_config_t *cfg){if(cfg&&cfg->gpio!=DRV_GPIO_NONE)s_gpio=cfg->gpio;if(cfg&&cfg->channels)s_count=cfg->channels;s_ready=true;ESP_LOGI(TAG,"WS2812B GPIO=%u count=%u",s_gpio,s_count);return DRV_OK;}
static drv_err_t ws2812b_read(driver_value_t *v,uint8_t *n){if(!s_ready||!v||!n)return DRV_ERR_STATE;*n=1;strcpy(v[0].key,"led_count");v[0].type=DRV_VAL_NUMBER;v[0].number_value=s_count;return DRV_OK;}
static drv_err_t ws2812b_command(const char *a,const void *b){const cJSON *j=(const cJSON*)b;const cJSON *fill=cJSON_GetObjectItem(j,"fill");const cJSON *off=cJSON_GetObjectItem(j,"off");if(fill){int r=cJSON_GetObjectItem(fill,"r")?cJSON_GetObjectItem(fill,"r")->valueint:0;int g=cJSON_GetObjectItem(fill,"g")?cJSON_GetObjectItem(fill,"g")->valueint:0;int _b=cJSON_GetObjectItem(fill,"b")?cJSON_GetObjectItem(fill,"b")->valueint:0;ESP_LOGI(TAG,"Fill RGB(%d,%d,%d)",r,g,_b);}if(off)ESP_LOGI(TAG,"Off");(void)a;return DRV_OK;}
static drv_err_t ws2812b_deinit(void){s_ready=false;return DRV_OK;}
static driver_t drv_ws2812b={.name="WS2812B",.init=ws2812b_init,.read=ws2812b_read,.command=ws2812b_command,.deinit=ws2812b_deinit};
IO_DRIVER_REGISTER(drv_ws2812b);
