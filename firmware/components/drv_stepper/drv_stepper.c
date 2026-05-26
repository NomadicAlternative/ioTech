#include "drv_stepper.h"
#include "driver/gpio.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>
#include "freertos/FreeRTOS.h"
static const char *TAG="drv_stepper"; static uint8_t s_pins[4]={255,255,255,255}; static bool s_ready=false; static int s_pos=0;
static const uint8_t half_step[8][4]={{1,0,0,0},{1,1,0,0},{0,1,0,0},{0,1,1,0},{0,0,1,0},{0,0,1,1},{0,0,0,1},{1,0,0,1}};
static drv_err_t stepper_init(const driver_config_t *cfg){if(!cfg)return DRV_ERR_ARG;s_pins[0]=cfg->gpio;s_pins[1]=cfg->gpio2;s_pins[2]=16;s_pins[3]=17;s_ready=true;for(int i=0;i<4;i++){gpio_config_t c={.pin_bit_mask=(1ULL<<s_pins[i]),.mode=GPIO_MODE_OUTPUT};gpio_config(&c);gpio_set_level(s_pins[i],0);}ESP_LOGI(TAG,"Stepper pins %u,%u,%u,%u",s_pins[0],s_pins[1],s_pins[2],s_pins[3]);return DRV_OK;}
static drv_err_t stepper_read(driver_value_t *v,uint8_t *n){if(!s_ready||!v||!n){return DRV_ERR_STATE;}*n=1;strcpy(v[0].key,"position");v[0].type=DRV_VAL_NUMBER;v[0].number_value=s_pos;return DRV_OK;}
static void step_one(int dir){static int idx=0;idx=(idx+dir+8)%8;for(int i=0;i<4;i++)gpio_set_level(s_pins[i],half_step[idx][i]);s_pos+=dir;}
static drv_err_t stepper_command(const char *a,const void *b){const cJSON *j=(const cJSON*)b;const cJSON *st=cJSON_GetObjectItem(j,"step");const cJSON *sp=cJSON_GetObjectItem(j,"speed");if(cJSON_IsNumber(st)){int n=st->valueint,d=n>0?1:-1;int delay=cJSON_IsNumber(sp)?(60000000/(sp->valueint*4096)):2000;for(int i=0;i<abs(n);i++){step_one(d);esp_rom_delay_us(delay);}}(void)a;return DRV_OK;}
static drv_err_t stepper_deinit(void){s_ready=false;return DRV_OK;}
static driver_t drv_stepper={.name="STEPPER",.init=stepper_init,.read=stepper_read,.command=stepper_command,.deinit=stepper_deinit};
IO_DRIVER_REGISTER(drv_stepper);
