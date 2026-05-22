#include "drv_ssd1306.h"
#include "driver/i2c.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>
static const char *TAG="drv_ssd1306"; static uint8_t s_addr=0x3C; static bool s_ready=false; static char s_text[4][22];
static void ssd1306_cmd(uint8_t c){uint8_t d[2]={0x00,c};i2c_master_write_to_device(I2C_NUM_0,s_addr,d,2,pdMS_TO_TICKS(10));}
static drv_err_t ssd1306_init(const driver_config_t *cfg){if(cfg&&cfg->i2c_addr)s_addr=cfg->i2c_addr;i2c_config_t c={.mode=I2C_MODE_MASTER,.sda_io_num=cfg?cfg->i2c_sda:21,.scl_io_num=cfg?cfg->i2c_scl:22,.sda_pullup_en=GPIO_PULLUP_ENABLE,.scl_pullup_en=GPIO_PULLUP_ENABLE,.master.clk_speed=400000};i2c_param_config(I2C_NUM_0,&c);i2c_driver_install(I2C_NUM_0,c.mode,0,0,0);uint8_t init[]={0xAE,0xD5,0x80,0xA8,0x3F,0xD3,0x00,0x40,0x8D,0x14,0x20,0x00,0xA1,0xC8,0xDA,0x12,0x81,0xCF,0xD9,0xF1,0xDB,0x40,0xA4,0xA6,0xAF};for(int i=0;i<25;i++)ssd1306_cmd(init[i]);memset(s_text,' ',sizeof(s_text));s_ready=true;ESP_LOGI(TAG,"SSD1306 I2C 0x%02X",s_addr);return DRV_OK;}
static drv_err_t ssd1306_read(driver_value_t *v,uint8_t *n){if(!s_ready||!v||!n)return DRV_ERR_STATE;*n=1;strcpy(v[0].key,"text");v[0].type=DRV_VAL_STRING;strncpy(v[0].string_value,s_text[0],sizeof(v[0].string_value));return DRV_OK;}
static drv_err_t ssd1306_command(const char *a,const void *b){const cJSON *j=(const cJSON*)b;const cJSON *txt=cJSON_GetObjectItem(j,"text");const cJSON *cl=cJSON_GetObjectItem(j,"clear");if(cl&&cJSON_IsTrue(cl)){ssd1306_cmd(0x01);memset(s_text,' ',sizeof(s_text));}if(txt&&cJSON_IsString(txt)){int ln=cJSON_GetObjectItem(j,"line")?cJSON_GetObjectItem(j,"line")->valueint:0;if(ln>=4)ln=3;strncpy(s_text[ln],txt->valuestring,21);ssd1306_cmd(0x21);ssd1306_cmd(ln*8);ssd1306_cmd(0x7F);for(const char *p=s_text[ln];*p;p++)i2c_master_write_to_device(I2C_NUM_0,s_addr,(uint8_t[]){0x40,*p},2,pdMS_TO_TICKS(1));}(void)a;return DRV_OK;}
static drv_err_t ssd1306_deinit(void){ssd1306_cmd(0xAE);s_ready=false;return DRV_OK;}
static driver_t drv_ssd1306={.name="SSD1306",.init=ssd1306_init,.read=ssd1306_read,.command=ssd1306_command,.deinit=ssd1306_deinit};
IO_DRIVER_REGISTER(drv_ssd1306);
