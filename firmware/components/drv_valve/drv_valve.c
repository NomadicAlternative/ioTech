#include "drv_valve.h"
#include "driver/gpio.h"
#include "cJSON.h"
#include "esp_log.h"
static const char *TAG="drv_valve"; static uint8_t s_gpio=255; static bool s_ready=false,s_on=false;
static drv_err_t valve_init(const driver_config_t *cfg){if(!cfg||cfg->gpio==DRV_GPIO_NONE)return DRV_ERR_ARG;s_gpio=cfg->gpio;s_ready=true;gpio_config_t c={.pin_bit_mask=(1ULL<<s_gpio),.mode=GPIO_MODE_OUTPUT};gpio_config(&c);gpio_set_level(s_gpio,0);ESP_LOGI(TAG,"Valve GPIO %u",s_gpio);return DRV_OK;}
static drv_err_t valve_read(driver_value_t *v,uint8_t *n){if(!s_ready||!v||!n)return DRV_ERR_STATE;*n=1;strcpy(v[0].key,"state");v[0].type=DRV_VAL_BOOL;v[0].bool_value=s_on;return DRV_OK;}
static drv_err_t valve_command(const char *a,const void *b){const cJSON *j=(const cJSON*)b;const cJSON *st=cJSON_GetObjectItem(j,"state");if(st){s_on=cJSON_IsTrue(st);gpio_set_level(s_gpio,s_on?1:0);}(void)a;return DRV_OK;}
static drv_err_t valve_deinit(void){gpio_set_level(s_gpio,0);s_ready=false;return DRV_OK;}
static driver_t drv_valve={.name="VALVE",.init=valve_init,.read=valve_read,.command=valve_command,.deinit=valve_deinit};
IO_DRIVER_REGISTER(drv_valve);
