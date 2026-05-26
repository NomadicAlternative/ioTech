#include "drv_pump.h"
#include "driver/gpio.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>
#include "freertos/FreeRTOS.h"
static const char *TAG="drv_pump"; static uint8_t s_gpio=255; static bool s_ready=false,s_on=false;
static drv_err_t pump_init(const driver_config_t *cfg){if(!cfg||cfg->gpio==DRV_GPIO_NONE)return DRV_ERR_ARG;s_gpio=cfg->gpio;s_ready=true;gpio_config_t c={.pin_bit_mask=(1ULL<<s_gpio),.mode=GPIO_MODE_OUTPUT};gpio_config(&c);gpio_set_level(s_gpio,0);ESP_LOGI(TAG,"Pump GPIO %u",s_gpio);return DRV_OK;}
static drv_err_t pump_read(driver_value_t *v,uint8_t *n){if(!s_ready||!v||!n){return DRV_ERR_STATE;}*n=1;strcpy(v[0].key,"state");v[0].type=DRV_VAL_BOOL;v[0].bool_value=s_on;return DRV_OK;}
static drv_err_t pump_command(const char *a,const void *b){const cJSON *j=(const cJSON*)b;const cJSON *dur=cJSON_GetObjectItem(j,"duration");s_on=true;gpio_set_level(s_gpio,1);int ms=cJSON_IsNumber(dur)?dur->valueint*1000:5000;vTaskDelay(pdMS_TO_TICKS(ms));s_on=false;gpio_set_level(s_gpio,0);(void)a;return DRV_OK;}
static drv_err_t pump_deinit(void){gpio_set_level(s_gpio,0);s_ready=false;return DRV_OK;}
static driver_t drv_pump={.name="PUMP",.init=pump_init,.read=pump_read,.command=pump_command,.deinit=pump_deinit};
IO_DRIVER_REGISTER(drv_pump);
