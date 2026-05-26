#include "drv_dht11.h"
#include "driver/gpio.h"
#include "rom/ets_sys.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>
static const char *TAG = "drv_dht11";
static uint8_t s_gpio = 255; static bool s_ready = false;
static float s_temp = 0, s_hum = 0;

static drv_err_t dht11_init(const driver_config_t *cfg) {
    if (!cfg || cfg->gpio == DRV_GPIO_NONE) return DRV_ERR_ARG;
    s_gpio = cfg->gpio; s_ready = true;
    gpio_config_t c = {.pin_bit_mask=(1ULL<<s_gpio),.mode=GPIO_MODE_INPUT,.pull_up_en=GPIO_PULLUP_ENABLE,.pull_down_en=GPIO_PULLDOWN_DISABLE,.intr_type=GPIO_INTR_DISABLE};
    gpio_config(&c); ESP_LOGI(TAG, "DHT11 on GPIO %u", s_gpio); return DRV_OK;
}
static drv_err_t dht11_read(driver_value_t *v, uint8_t *n) {
    if (!s_ready||!v||!n){return DRV_ERR_STATE;}*n=0;
    uint8_t d[5]={0};
    gpio_set_direction(s_gpio, GPIO_MODE_OUTPUT);
    gpio_set_level(s_gpio,1); esp_rom_delay_us(250);
    gpio_set_level(s_gpio,0); esp_rom_delay_us(18000);
    gpio_set_level(s_gpio,1); esp_rom_delay_us(30);
    gpio_set_direction(s_gpio, GPIO_MODE_INPUT);
    int to=0; while(gpio_get_level(s_gpio)==1){if(++to>200){ESP_LOGE(TAG,"Timeout");return DRV_ERR_TIMEOUT;}esp_rom_delay_us(1);}
    to=0; while(gpio_get_level(s_gpio)==0){if(++to>200)return DRV_ERR_TIMEOUT;esp_rom_delay_us(1);}
    to=0; while(gpio_get_level(s_gpio)==1){if(++to>200)return DRV_ERR_TIMEOUT;esp_rom_delay_us(1);}
    for(int i=0;i<40;i++){to=0;while(gpio_get_level(s_gpio)==0){if(++to>200)return DRV_ERR_TIMEOUT;esp_rom_delay_us(1);}
        esp_rom_delay_us(30);if(gpio_get_level(s_gpio)==1)d[i/8]|=(1<<(7-(i%8)));
        to=0;while(gpio_get_level(s_gpio)==1){if(++to>200)return DRV_ERR_TIMEOUT;esp_rom_delay_us(1);}}
    if(d[4]!=(uint8_t)(d[0]+d[1]+d[2]+d[3]))return DRV_ERR_CHECKSUM;
    s_temp=d[2]; s_hum=d[0]; *n=2;
    strcpy(v[0].key,"temperature");v[0].type=DRV_VAL_NUMBER;v[0].number_value=s_temp;
    strcpy(v[1].key,"humidity");v[1].type=DRV_VAL_NUMBER;v[1].number_value=s_hum;
    return DRV_OK;
}
static drv_err_t dht11_command(const char *a, const void *b){(void)a;(void)b;return DRV_ERR_NOT_SUPP;}
static drv_err_t dht11_deinit(void){s_ready=false;return DRV_OK;}
static driver_t drv_dht11={.name="DHT11",.init=dht11_init,.read=dht11_read,.command=dht11_command,.deinit=dht11_deinit};
IO_DRIVER_REGISTER(drv_dht11);
