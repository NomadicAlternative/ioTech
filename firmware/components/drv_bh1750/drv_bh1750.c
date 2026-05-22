#include "drv_bh1750.h"
#include "driver/i2c.h"
#include "cJSON.h"
#include "esp_log.h"
static const char *TAG="drv_bh1750"; static uint8_t s_addr=0x23; static bool s_ready=false;
static esp_err_t i2c_write(uint8_t cmd){i2c_cmd_handle_t h=i2c_cmd_link_create();i2c_master_start(h);i2c_master_write_byte(h,(s_addr<<1)|I2C_MASTER_WRITE,true);i2c_master_write_byte(h,cmd,true);i2c_master_stop(h);esp_err_t r=i2c_master_cmd_begin(I2C_NUM_0,h,pdMS_TO_TICKS(100));i2c_cmd_link_delete(h);return r;}
static esp_err_t i2c_read(uint8_t *buf,size_t len){i2c_cmd_handle_t h=i2c_cmd_link_create();i2c_master_start(h);i2c_master_write_byte(h,(s_addr<<1)|I2C_MASTER_READ,true);i2c_master_read(h,buf,len,I2C_MASTER_LAST_NACK);i2c_master_stop(h);esp_err_t r=i2c_master_cmd_begin(I2C_NUM_0,h,pdMS_TO_TICKS(200));i2c_cmd_link_delete(h);return r;}
static drv_err_t bh1750_init(const driver_config_t *cfg){if(cfg&&cfg->i2c_addr)s_addr=cfg->i2c_addr;s_ready=true;i2c_write(0x01);vTaskDelay(pdMS_TO_TICKS(10));i2c_write(0x10);ESP_LOGI(TAG,"BH1750 I2C 0x%02X",s_addr);return DRV_OK;}
static drv_err_t bh1750_read(driver_value_t *v,uint8_t *n){if(!s_ready||!v||!n)return DRV_ERR_STATE;*n=1;i2c_write(0x10);vTaskDelay(pdMS_TO_TICKS(180));uint8_t d[2]={0};if(i2c_read(d,2)!=ESP_OK)return DRV_ERR_BUS;float lux=((d[0]<<8)|d[1])/1.2f;strcpy(v[0].key,"light");v[0].type=DRV_VAL_NUMBER;v[0].number_value=lux;return DRV_OK;}
static drv_err_t bh1750_command(const char *a,const void *b){(void)a;(void)b;return DRV_ERR_NOT_SUPP;}
static drv_err_t bh1750_deinit(void){s_ready=false;return DRV_OK;}
static driver_t drv_bh1750={.name="BH1750",.init=bh1750_init,.read=bh1750_read,.command=bh1750_command,.deinit=bh1750_deinit};
IO_DRIVER_REGISTER(drv_bh1750);
