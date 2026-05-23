#include "drv_hcsr04.h"
#include "driver/gpio.h"
#include "esp_timer.h"
#include "rom/ets_sys.h"
#include "cJSON.h"
#include "esp_log.h"
static const char *TAG="drv_hcsr04"; static uint8_t s_trig=255,s_echo=255; static bool s_ready=false;
static drv_err_t hcsr04_init(const driver_config_t *cfg){if(!cfg||cfg->gpio==DRV_GPIO_NONE||cfg->gpio2==DRV_GPIO_NONE)return DRV_ERR_ARG;s_trig=cfg->gpio;s_echo=cfg->gpio2;s_ready=true;gpio_config_t to={.pin_bit_mask=(1ULL<<s_trig),.mode=GPIO_MODE_OUTPUT};gpio_config(&to);gpio_set_level(s_trig,0);gpio_config_t ei={.pin_bit_mask=(1ULL<<s_echo),.mode=GPIO_MODE_INPUT};gpio_config(&ei);ESP_LOGI(TAG,"HC-SR04 trig=%u echo=%u",s_trig,s_echo);return DRV_OK;}
static drv_err_t hcsr04_read(driver_value_t *v,uint8_t *n){if(!s_ready||!v||!n)return DRV_ERR_STATE;*n=1;gpio_set_level(s_trig,1);esp_rom_delay_us(10);gpio_set_level(s_trig,0);int to=30000;while(gpio_get_level(s_echo)==0&&--to>0)esp_rom_delay_us(1);int64_t st=esp_timer_get_time();to=30000;while(gpio_get_level(s_echo)==1&&--to>0)esp_rom_delay_us(1);int64_t et=esp_timer_get_time();float d=(to<=0)?-1:((et-st)*0.0343f/2.0f);strcpy(v[0].key,"distance");v[0].type=DRV_VAL_NUMBER;v[0].number_value=d;return DRV_OK;}
static drv_err_t hcsr04_command(const char *a,const void *b){(void)a;(void)b;return DRV_ERR_NOT_SUPP;}
static drv_err_t hcsr04_deinit(void){s_ready=false;return DRV_OK;}
static driver_t drv_hcsr04={.name="HC-SR04",.init=hcsr04_init,.read=hcsr04_read,.command=hcsr04_command,.deinit=hcsr04_deinit};
IO_DRIVER_REGISTER(drv_hcsr04);
