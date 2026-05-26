#include "drv_ccs811.h"
#include "driver/i2c.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>
static const char *TAG="drv_ccs811"; static uint8_t s_addr=0x5A; static bool s_ready=false; static uint16_t s_eco2=0,s_tvoc=0;
static uint8_t read_reg8(uint8_t reg){uint8_t v=0;i2c_master_write_read_device(I2C_NUM_0,s_addr,&reg,1,&v,1,pdMS_TO_TICKS(100));return v;}
static drv_err_t ccs811_init(const driver_config_t *cfg){
    if(cfg&&cfg->i2c_addr){s_addr=cfg->i2c_addr;}s_ready=true;
    i2c_config_t c={.mode=I2C_MODE_MASTER,.sda_io_num=cfg?cfg->i2c_sda:21,.scl_io_num=cfg?cfg->i2c_scl:22,.sda_pullup_en=GPIO_PULLUP_ENABLE,.scl_pullup_en=GPIO_PULLUP_ENABLE,.master.clk_speed=100000};
    i2c_param_config(I2C_NUM_0,&c);i2c_driver_install(I2C_NUM_0,c.mode,0,0,0);
    uint8_t app[1]={0xF4};i2c_master_write_to_device(I2C_NUM_0,s_addr,app,1,pdMS_TO_TICKS(100));vTaskDelay(pdMS_TO_TICKS(100));
    ESP_LOGI(TAG,"CCS811 I2C 0x%02X status=0x%02X",s_addr,read_reg8(0x00));return DRV_OK;
}
static drv_err_t ccs811_read(driver_value_t *v,uint8_t *n){
    if(!s_ready||!v||!n){return DRV_ERR_STATE;}*n=2;
    uint8_t st=read_reg8(0x00);if(!(st&0x10)){strcpy(v[0].key,"eco2");v[0].type=DRV_VAL_NUMBER;v[0].number_value=400;
    strcpy(v[1].key,"tvoc");v[1].type=DRV_VAL_NUMBER;v[1].number_value=0;return DRV_OK;}
    uint8_t d[4]={0};uint8_t reg=0x02;i2c_master_write_read_device(I2C_NUM_0,s_addr,&reg,1,d,4,pdMS_TO_TICKS(100));
    s_eco2=(d[0]<<8)|d[1];s_tvoc=(d[2]<<8)|d[3];
    strcpy(v[0].key,"eco2");v[0].type=DRV_VAL_NUMBER;v[0].number_value=s_eco2;
    strcpy(v[1].key,"tvoc");v[1].type=DRV_VAL_NUMBER;v[1].number_value=s_tvoc;
    return DRV_OK;
}
static drv_err_t ccs811_command(const char *a,const void *b){(void)a;(void)b;return DRV_ERR_NOT_SUPP;}
static drv_err_t ccs811_deinit(void){s_ready=false;return DRV_OK;}
static driver_t drv_ccs811={.name="CCS811",.init=ccs811_init,.read=ccs811_read,.command=ccs811_command,.deinit=ccs811_deinit};
IO_DRIVER_REGISTER(drv_ccs811);
