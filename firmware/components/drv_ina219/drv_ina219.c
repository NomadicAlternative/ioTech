#include "drv_ina219.h"
#include "driver/i2c.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>
static const char *TAG="drv_ina219"; static uint8_t s_addr=0x40; static bool s_ready=false;
static uint16_t read_reg(uint8_t reg){uint8_t d[2]={0};i2c_master_write_read_device(I2C_NUM_0,s_addr,&reg,1,d,2,pdMS_TO_TICKS(100));return (d[0]<<8)|d[1];}
static drv_err_t ina219_init(const driver_config_t *cfg){
    if(cfg&&cfg->i2c_addr){s_addr=cfg->i2c_addr;}s_ready=true;
    i2c_config_t c={.mode=I2C_MODE_MASTER,.sda_io_num=cfg?cfg->i2c_sda:21,.scl_io_num=cfg?cfg->i2c_scl:22,.sda_pullup_en=GPIO_PULLUP_ENABLE,.scl_pullup_en=GPIO_PULLUP_ENABLE,.master.clk_speed=100000};
    i2c_param_config(I2C_NUM_0,&c);i2c_driver_install(I2C_NUM_0,c.mode,0,0,0);
    ESP_LOGI(TAG,"INA219 I2C 0x%02X",s_addr);return DRV_OK;
}
static drv_err_t ina219_read(driver_value_t *v,uint8_t *n){
    if(!s_ready||!v||!n){return DRV_ERR_STATE;}*n=3;
    float bus=(read_reg(0x02)>>3)*0.004f,shunt=(int16_t)read_reg(0x01)*0.00001f,power=bus*shunt*1000;
    strcpy(v[0].key,"voltage");v[0].type=DRV_VAL_NUMBER;v[0].number_value=bus;
    strcpy(v[1].key,"current");v[1].type=DRV_VAL_NUMBER;v[1].number_value=shunt;
    strcpy(v[2].key,"power");v[2].type=DRV_VAL_NUMBER;v[2].number_value=power;
    return DRV_OK;
}
static drv_err_t ina219_command(const char *a,const void *b){(void)a;(void)b;return DRV_ERR_NOT_SUPP;}
static drv_err_t ina219_deinit(void){s_ready=false;return DRV_OK;}
static driver_t drv_ina219={.name="INA219",.init=ina219_init,.read=ina219_read,.command=ina219_command,.deinit=ina219_deinit};
IO_DRIVER_REGISTER(drv_ina219);
