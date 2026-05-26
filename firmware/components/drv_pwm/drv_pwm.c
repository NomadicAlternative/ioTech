#include "drv_pwm.h"
#include "driver/ledc.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>
static const char *TAG="drv_pwm"; static uint8_t s_gpio=18; static uint32_t s_freq=5000; static uint8_t s_duty=0; static bool s_ready=false;
static drv_err_t pwm_init(const driver_config_t *cfg){if(cfg&&cfg->gpio!=DRV_GPIO_NONE)s_gpio=cfg->gpio;s_ready=true;ledc_timer_config_t t={.speed_mode=LEDC_LOW_SPEED_MODE,.duty_resolution=LEDC_TIMER_10_BIT,.timer_num=LEDC_TIMER_3,.freq_hz=s_freq,.clk_cfg=LEDC_AUTO_CLK};ledc_timer_config(&t);ledc_channel_config_t ch={.speed_mode=LEDC_LOW_SPEED_MODE,.channel=LEDC_CHANNEL_3,.timer_sel=LEDC_TIMER_3,.intr_type=LEDC_INTR_DISABLE,.gpio_num=s_gpio,.duty=0,.hpoint=0};ledc_channel_config(&ch);ESP_LOGI(TAG,"PWM GPIO=%u freq=%lu",s_gpio,(unsigned long)s_freq);return DRV_OK;}
static drv_err_t pwm_read(driver_value_t *v,uint8_t *n){if(!s_ready||!v||!n){return DRV_ERR_STATE;}*n=2;strcpy(v[0].key,"duty");v[0].type=DRV_VAL_NUMBER;v[0].number_value=s_duty;strcpy(v[1].key,"frequency");v[1].type=DRV_VAL_NUMBER;v[1].number_value=s_freq;return DRV_OK;}
static drv_err_t pwm_command(const char *a,const void *b){const cJSON *j=(const cJSON*)b;const cJSON *d=cJSON_GetObjectItem(j,"duty");if(cJSON_IsNumber(d)){s_duty=d->valueint;if(s_duty>100)s_duty=100;ledc_set_duty(LEDC_LOW_SPEED_MODE,LEDC_CHANNEL_3,(uint32_t)(s_duty*1023/100));ledc_update_duty(LEDC_LOW_SPEED_MODE,LEDC_CHANNEL_3);}(void)a;return DRV_OK;}
static drv_err_t pwm_deinit(void){s_ready=false;ledc_stop(LEDC_LOW_SPEED_MODE,LEDC_CHANNEL_3,0);return DRV_OK;}
static driver_t drv_pwm={.name="PWM",.init=pwm_init,.read=pwm_read,.command=pwm_command,.deinit=pwm_deinit};
IO_DRIVER_REGISTER(drv_pwm);
