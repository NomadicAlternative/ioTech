#include "drv_buzzer.h"
#include "driver/gpio.h"
#include "driver/ledc.h"
#include "cJSON.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
static const char *TAG="drv_buzzer"; static uint8_t s_gpio=255; static bool s_ready=false;
static drv_err_t buzzer_init(const driver_config_t *cfg){if(!cfg||cfg->gpio==DRV_GPIO_NONE)return DRV_ERR_ARG;s_gpio=cfg->gpio;s_ready=true;gpio_config_t c={.pin_bit_mask=(1ULL<<s_gpio),.mode=GPIO_MODE_OUTPUT,.pull_up_en=GPIO_PULLUP_DISABLE,.pull_down_en=GPIO_PULLDOWN_DISABLE,.intr_type=GPIO_INTR_DISABLE};gpio_config(&c);gpio_set_level(s_gpio,0);ESP_LOGI(TAG,"Buzzer on GPIO %u",s_gpio);return DRV_OK;}
static drv_err_t buzzer_read(driver_value_t *v,uint8_t *n){if(!s_ready||!v||!n)return DRV_ERR_STATE;*n=1;strcpy(v[0].key,"state");v[0].type=DRV_VAL_BOOL;v[0].bool_value=gpio_get_level(s_gpio);return DRV_OK;}
static drv_err_t buzzer_command(const char *a,const void *b){if(!s_ready)return DRV_ERR_STATE;const cJSON *j=(const cJSON*)b;const cJSON *freq=cJSON_GetObjectItem(j,"frequency");const cJSON *dur=cJSON_GetObjectItem(j,"duration");ledc_timer_config_t t={.speed_mode=LEDC_LOW_SPEED_MODE,.duty_resolution=LEDC_TIMER_13_BIT,.timer_num=LEDC_TIMER_1,.freq_hz=cJSON_IsNumber(freq)?freq->valueint:1000,.clk_cfg=LEDC_AUTO_CLK};ledc_timer_config(&t);ledc_channel_config_t ch={.speed_mode=LEDC_LOW_SPEED_MODE,.channel=LEDC_CHANNEL_1,.timer_sel=LEDC_TIMER_1,.intr_type=LEDC_INTR_DISABLE,.gpio_num=s_gpio,.duty=4096,.hpoint=0};ledc_channel_config(&ch);vTaskDelay(pdMS_TO_TICKS(cJSON_IsNumber(dur)?dur->valueint:200));ledc_stop(LEDC_LOW_SPEED_MODE,LEDC_CHANNEL_1,0);(void)a;return DRV_OK;}
static drv_err_t buzzer_deinit(void){s_ready=false;ledc_stop(LEDC_LOW_SPEED_MODE,LEDC_CHANNEL_1,0);return DRV_OK;}
static driver_t drv_buzzer={.name="BUZZER",.init=buzzer_init,.read=buzzer_read,.command=buzzer_command,.deinit=buzzer_deinit};
IO_DRIVER_REGISTER(drv_buzzer);
