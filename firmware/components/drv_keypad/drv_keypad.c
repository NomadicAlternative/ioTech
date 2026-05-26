#include "drv_keypad.h"
#include "driver/gpio.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>
static const char *TAG="drv_keypad"; static uint8_t s_rows[4],s_cols[4]; static bool s_ready=false;
static const char keys[4][4]={{'1','2','3','A'},{'4','5','6','B'},{'7','8','9','C'},{'*','0','#','D'}};
static drv_err_t keypad_init(const driver_config_t *cfg){(void)cfg;uint8_t rp[]={14,27,26,25},cp[]={33,32,35,34};for(int i=0;i<4;i++){s_rows[i]=rp[i];s_cols[i]=cp[i];gpio_config_t ro={.pin_bit_mask=(1ULL<<s_rows[i]),.mode=GPIO_MODE_OUTPUT};gpio_config(&ro);gpio_set_level(s_rows[i],1);gpio_config_t ci={.pin_bit_mask=(1ULL<<s_cols[i]),.mode=GPIO_MODE_INPUT,.pull_up_en=GPIO_PULLUP_ENABLE};gpio_config(&ci);}s_ready=true;ESP_LOGI(TAG,"Keypad ready");return DRV_OK;}
static drv_err_t keypad_read(driver_value_t *v,uint8_t *n){if(!s_ready||!v||!n){return DRV_ERR_STATE;}*n=1;strcpy(v[0].key,"key");v[0].type=DRV_VAL_STRING;v[0].string_value[0]='\0';for(int r=0;r<4;r++){gpio_set_level(s_rows[r],0);for(int c=0;c<4;c++){if(gpio_get_level(s_cols[c])==0){v[0].string_value[0]=keys[r][c];v[0].string_value[1]='\0';}}gpio_set_level(s_rows[r],1);}return DRV_OK;}
static drv_err_t keypad_command(const char *a,const void *b){(void)a;(void)b;return DRV_ERR_NOT_SUPP;}
static drv_err_t keypad_deinit(void){s_ready=false;return DRV_OK;}
static driver_t drv_keypad={.name="KEYPAD",.init=keypad_init,.read=keypad_read,.command=keypad_command,.deinit=keypad_deinit};
IO_DRIVER_REGISTER(drv_keypad);
