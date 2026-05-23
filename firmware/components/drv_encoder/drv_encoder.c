#include "drv_encoder.h"
#include "driver/gpio.h"
#include "cJSON.h"
#include "esp_log.h"
static const char *TAG="drv_encoder"; static uint8_t s_a=255,s_b=255,s_btn=255; static bool s_ready=false; static int s_pos=0;
static drv_err_t encoder_init(const driver_config_t *cfg){s_a=cfg?cfg->gpio:14;s_b=cfg?cfg->gpio2:27;s_btn=15;s_ready=true;gpio_config_t c={.pin_bit_mask=(1ULL<<s_a)|(1ULL<<s_b)|(1ULL<<s_btn),.mode=GPIO_MODE_INPUT,.pull_up_en=GPIO_PULLUP_ENABLE,.intr_type=GPIO_INTR_DISABLE};gpio_config(&c);ESP_LOGI(TAG,"Encoder A=%u B=%u BTN=%u",s_a,s_b,s_btn);return DRV_OK;}
static drv_err_t encoder_read(driver_value_t *v,uint8_t *n){if(!s_ready||!v||!n)return DRV_ERR_STATE;*n=2;static int la=1;int a=gpio_get_level(s_a),b=gpio_get_level(s_b);if(a!=la){s_pos+=(a==b)?-1:1;la=a;}strcpy(v[0].key,"position");v[0].type=DRV_VAL_NUMBER;v[0].number_value=s_pos;strcpy(v[1].key,"button");v[1].type=DRV_VAL_BOOL;v[1].bool_value=gpio_get_level(s_btn)==0;return DRV_OK;}
static drv_err_t encoder_command(const char *a,const void *b){(void)a;(void)b;return DRV_ERR_NOT_SUPP;}
static drv_err_t encoder_deinit(void){s_ready=false;return DRV_OK;}
static driver_t drv_encoder={.name="ENCODER",.init=encoder_init,.read=encoder_read,.command=encoder_command,.deinit=encoder_deinit};
IO_DRIVER_REGISTER(drv_encoder);
