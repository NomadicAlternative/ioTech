#include "drv_servo.h"
#include "io_board.h"
#include "driver/ledc.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>
static const char *TAG="drv_servo"; static uint8_t s_gpio=255; static bool s_ready=false; static int s_angle=90;
static drv_err_t servo_init(const driver_config_t *cfg){if(!cfg||cfg->gpio==DRV_GPIO_NONE)return DRV_ERR_ARG;s_gpio=cfg->gpio;s_ready=true;ledc_timer_config_t t={.speed_mode=LEDC_LOW_SPEED_MODE,.duty_resolution=BOARD_LEDC_TIMER_BIT,.timer_num=LEDC_TIMER_2,.freq_hz=50,.clk_cfg=LEDC_AUTO_CLK};ledc_timer_config(&t);ledc_channel_config_t ch={.speed_mode=LEDC_LOW_SPEED_MODE,.channel=LEDC_CHANNEL_2,.timer_sel=LEDC_TIMER_2,.intr_type=LEDC_INTR_DISABLE,.gpio_num=s_gpio,.duty=(500+1500*90/90)*65536/20000,.hpoint=0};ledc_channel_config(&ch);ESP_LOGI(TAG,"Servo on GPIO %u",s_gpio);return DRV_OK;}
static drv_err_t servo_read(driver_value_t *v,uint8_t *n){if(!s_ready||!v||!n){return DRV_ERR_STATE;}*n=1;strcpy(v[0].key,"angle");v[0].type=DRV_VAL_NUMBER;v[0].number_value=s_angle;return DRV_OK;}
static drv_err_t servo_command(const char *a,const void *b){const cJSON *j=(const cJSON*)b;const cJSON *ang=cJSON_GetObjectItem(j,"angle");if(cJSON_IsNumber(ang)){s_angle=ang->valueint;if(s_angle<0)s_angle=0;if(s_angle>180)s_angle=180;int duty=(500+s_angle*2000/180)*65536/20000;ledc_set_duty(LEDC_LOW_SPEED_MODE,LEDC_CHANNEL_2,duty);ledc_update_duty(LEDC_LOW_SPEED_MODE,LEDC_CHANNEL_2);}(void)a;return DRV_OK;}
static drv_err_t servo_deinit(void){s_ready=false;ledc_stop(LEDC_LOW_SPEED_MODE,LEDC_CHANNEL_2,0);return DRV_OK;}
static driver_t drv_servo={.name="SERVO",.init=servo_init,.read=servo_read,.command=servo_command,.deinit=servo_deinit};
IO_DRIVER_REGISTER(drv_servo);
