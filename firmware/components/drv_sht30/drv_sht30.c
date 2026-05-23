#include "drv_sht30.h"
#include "driver/i2c.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>
static const char *TAG="drv_sht30"; static uint8_t s_addr=0x44; static bool s_ready=false; static float s_temp=0,s_hum=0;
static esp_err_t sht30_cmd(uint16_t cmd){uint8_t b[2]={cmd>>8,cmd&0xFF};i2c_cmd_handle_t h=i2c_cmd_link_create();i2c_master_start(h);i2c_master_write_byte(h,(s_addr<<1)|I2C_MASTER_WRITE,true);i2c_master_write(h,b,2,true);i2c_master_stop(h);esp_err_t r=i2c_master_cmd_begin(I2C_NUM_0,h,pdMS_TO_TICKS(100));i2c_cmd_link_delete(h);return r;}
static drv_err_t sht30_init(const driver_config_t *cfg){
    if(cfg&&cfg->i2c_addr)s_addr=cfg->i2c_addr;s_ready=true;
    i2c_config_t c={.mode=I2C_MODE_MASTER,.sda_io_num=cfg?cfg->i2c_sda:21,.scl_io_num=cfg?cfg->i2c_scl:22,.sda_pullup_en=GPIO_PULLUP_ENABLE,.scl_pullup_en=GPIO_PULLUP_ENABLE,.master.clk_speed=100000};
    i2c_param_config(I2C_NUM_0,&c);i2c_driver_install(I2C_NUM_0,c.mode,0,0,0);
    ESP_LOGI(TAG,"SHT30 I2C 0x%02X",s_addr);return DRV_OK;
}
static drv_err_t sht30_read(driver_value_t *v,uint8_t *n){
    if(!s_ready||!v||!n)return DRV_ERR_STATE;*n=2;
    sht30_cmd(0x2C06);vTaskDelay(pdMS_TO_TICKS(20));uint8_t d[6]={0};
    i2c_master_read_from_device(I2C_NUM_0,s_addr,d,6,pdMS_TO_TICKS(100));
    s_temp=-45+175*((d[0]<<8)|d[1])/65535.0f;s_hum=100*((d[3]<<8)|d[4])/65535.0f;
    strcpy(v[0].key,"temperature");v[0].type=DRV_VAL_NUMBER;v[0].number_value=s_temp;
    strcpy(v[1].key,"humidity");v[1].type=DRV_VAL_NUMBER;v[1].number_value=s_hum;
    return DRV_OK;
}
static drv_err_t sht30_command(const char *a,const void *b){(void)a;(void)b;return DRV_ERR_NOT_SUPP;}
static drv_err_t sht30_deinit(void){s_ready=false;return DRV_OK;}
static driver_t drv_sht30={.name="SHT30",.init=sht30_init,.read=sht30_read,.command=sht30_command,.deinit=sht30_deinit};
IO_DRIVER_REGISTER(drv_sht30);
