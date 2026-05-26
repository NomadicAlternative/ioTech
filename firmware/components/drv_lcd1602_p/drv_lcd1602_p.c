#include "drv_lcd1602_p.h"
#include "driver/gpio.h"
#include "rom/ets_sys.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>
#include <string.h>
static const char *TAG="drv_lcd1602_p"; static uint8_t s_rs=255,s_en=255,s_d4=255,s_d5=255,s_d6=255,s_d7=255; static bool s_ready=false; static char s_buf[2][17];
static void pulse_en(void){gpio_set_level(s_en,1);esp_rom_delay_us(1);gpio_set_level(s_en,0);esp_rom_delay_us(50);}
static void lcd_nibble(uint8_t n){gpio_set_level(s_d4,n&1);gpio_set_level(s_d5,(n>>1)&1);gpio_set_level(s_d6,(n>>2)&1);gpio_set_level(s_d7,(n>>3)&1);pulse_en();}
static void lcd_byte(uint8_t b,uint8_t rs){gpio_set_level(s_rs,rs);lcd_nibble(b>>4);lcd_nibble(b);}
static drv_err_t lcd1602_p_init(const driver_config_t *cfg){s_rs=cfg?cfg->gpio:12;s_en=cfg?cfg->gpio2:13;uint8_t ps[]={14,26,27,33};s_d4=ps[0];s_d5=ps[1];s_d6=ps[2];s_d7=ps[3];uint8_t all[]={s_rs,s_en,s_d4,s_d5,s_d6,s_d7};for(int i=0;i<6;i++){gpio_config_t c={.pin_bit_mask=(1ULL<<all[i]),.mode=GPIO_MODE_OUTPUT};gpio_config(&c);gpio_set_level(all[i],0);}esp_rom_delay_us(50000);lcd_nibble(0x03);esp_rom_delay_us(4500);lcd_nibble(0x03);esp_rom_delay_us(150);lcd_nibble(0x03);lcd_nibble(0x02);lcd_byte(0x28,0);lcd_byte(0x0C,0);lcd_byte(0x01,0);lcd_byte(0x06,0);memset(s_buf,' ',sizeof(s_buf));s_ready=true;ESP_LOGI(TAG,"LCD1602_P RS=%u EN=%u",s_rs,s_en);return DRV_OK;}
static drv_err_t lcd1602_p_read(driver_value_t *v,uint8_t *n){if(!s_ready){return DRV_ERR_STATE;}*n=1;strcpy(v[0].key,"text");v[0].type=DRV_VAL_STRING;strncpy(v[0].string_value,s_buf[0],sizeof(v[0].string_value));return DRV_OK;}
static drv_err_t lcd1602_p_command(const char *a,const void *b){const cJSON *j=(const cJSON*)b;const cJSON *txt=cJSON_GetObjectItem(j,"text");const cJSON *cl=cJSON_GetObjectItem(j,"clear");if(cl&&cJSON_IsTrue(cl)){lcd_byte(0x01,0);memset(s_buf,' ',sizeof(s_buf));}if(txt&&cJSON_IsString(txt)){int r=cJSON_GetObjectItem(j,"row")?cJSON_GetObjectItem(j,"row")->valueint:0;int c=cJSON_GetObjectItem(j,"col")?cJSON_GetObjectItem(j,"col")->valueint:0;if(r>=2)r=1;lcd_byte(0x80|(r?0x40:0x00)|c,0);for(int i=0;txt->valuestring[i]&&(c+i)<16;i++){lcd_byte(txt->valuestring[i],1);s_buf[r][c+i]=txt->valuestring[i];}}(void)a;return DRV_OK;}
static drv_err_t lcd1602_p_deinit(void){s_ready=false;return DRV_OK;}
static driver_t drv_lcd1602_p={.name="LCD1602_P",.init=lcd1602_p_init,.read=lcd1602_p_read,.command=lcd1602_p_command,.deinit=lcd1602_p_deinit};
IO_DRIVER_REGISTER(drv_lcd1602_p);
