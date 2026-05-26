#include "drv_pir.h"
#include "driver/gpio.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>
static const char *TAG="drv_pir"; static uint8_t s_gpio=255; static bool s_ready=false;
static drv_err_t pir_init(const driver_config_t *cfg){if(!cfg||cfg->gpio==DRV_GPIO_NONE)return DRV_ERR_ARG;s_gpio=cfg->gpio;s_ready=true;gpio_config_t c={.pin_bit_mask=(1ULL<<s_gpio),.mode=GPIO_MODE_INPUT,.pull_up_en=GPIO_PULLUP_DISABLE,.pull_down_en=GPIO_PULLDOWN_ENABLE,.intr_type=GPIO_INTR_DISABLE};gpio_config(&c);ESP_LOGI(TAG,"PIR on GPIO %u",s_gpio);return DRV_OK;}
static drv_err_t pir_read(driver_value_t *v,uint8_t *n){if(!s_ready||!v||!n){return DRV_ERR_STATE;}*n=1;strcpy(v[0].key,"motion");v[0].type=DRV_VAL_BOOL;v[0].bool_value=gpio_get_level(s_gpio)==1;return DRV_OK;}
static drv_err_t pir_command(const char *a,const void *b){(void)a;(void)b;return DRV_ERR_NOT_SUPP;}
static drv_err_t pir_deinit(void){s_ready=false;return DRV_OK;}
static driver_t drv_pir={.name="PIR",.init=pir_init,.read=pir_read,.command=pir_command,.deinit=pir_deinit};
IO_DRIVER_REGISTER(drv_pir);
