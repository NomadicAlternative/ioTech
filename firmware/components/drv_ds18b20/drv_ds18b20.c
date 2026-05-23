#include "drv_ds18b20.h"
#include "driver/gpio.h"
#include "rom/ets_sys.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>
static const char *TAG="drv_ds18b20"; static uint8_t s_gpio=255; static bool s_ready=false; static float s_temp=0;
static int ow_reset(void){gpio_set_direction(s_gpio,GPIO_MODE_OUTPUT);gpio_set_level(s_gpio,0);esp_rom_delay_us(480);gpio_set_level(s_gpio,1);esp_rom_delay_us(70);gpio_set_direction(s_gpio,GPIO_MODE_INPUT);int p=gpio_get_level(s_gpio);esp_rom_delay_us(410);return p==0?0:-1;}
static void ow_write_bit(int bit){gpio_set_direction(s_gpio,GPIO_MODE_OUTPUT);gpio_set_level(s_gpio,0);esp_rom_delay_us(bit?2:65);gpio_set_level(s_gpio,1);esp_rom_delay_us(bit?65:2);}
static int ow_read_bit(void){int b;gpio_set_direction(s_gpio,GPIO_MODE_OUTPUT);gpio_set_level(s_gpio,0);esp_rom_delay_us(2);gpio_set_direction(s_gpio,GPIO_MODE_INPUT);esp_rom_delay_us(10);b=gpio_get_level(s_gpio);esp_rom_delay_us(50);return b;}
static void ow_write(uint8_t v){for(int i=0;i<8;i++){ow_write_bit(v&1);v>>=1;}}
static uint8_t ow_read(void){uint8_t v=0;for(int i=0;i<8;i++){v>>=1;if(ow_read_bit())v|=0x80;}return v;}
static drv_err_t ds18b20_init(const driver_config_t *cfg){if(!cfg||cfg->gpio==DRV_GPIO_NONE)return DRV_ERR_ARG;s_gpio=cfg->gpio;s_ready=true;ESP_LOGI(TAG,"DS18B20 on GPIO %u",s_gpio);return DRV_OK;}
static drv_err_t ds18b20_read(driver_value_t *v,uint8_t *n){
    if(!s_ready||!v||!n)return DRV_ERR_STATE;*n=1;
    if(ow_reset()!=0)return DRV_ERR_TIMEOUT;ow_write(0xCC);ow_write(0x44);vTaskDelay(pdMS_TO_TICKS(750));
    if(ow_reset()!=0)return DRV_ERR_TIMEOUT;ow_write(0xCC);ow_write(0xBE);
    uint8_t d[9];for(int i=0;i<9;i++)d[i]=ow_read();
    s_temp=((d[1]<<8)|d[0])/16.0f;strcpy(v[0].key,"temperature");v[0].type=DRV_VAL_NUMBER;v[0].number_value=s_temp;
    return DRV_OK;
}
static drv_err_t ds18b20_command(const char *a,const void *b){(void)a;(void)b;return DRV_ERR_NOT_SUPP;}
static drv_err_t ds18b20_deinit(void){s_ready=false;return DRV_OK;}
static driver_t drv_ds18b20={.name="DS18B20",.init=ds18b20_init,.read=ds18b20_read,.command=ds18b20_command,.deinit=ds18b20_deinit};
IO_DRIVER_REGISTER(drv_ds18b20);
