#include "drv_bme280.h"
#include "driver/i2c.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>
static const char *TAG="drv_bme280"; static uint8_t s_addr=0x76; static bool s_ready=false;
static float s_temp=0,s_hum=0,s_pres=0;
static uint8_t i2c_read_reg(uint8_t reg){uint8_t v=0;i2c_master_write_read_device(I2C_NUM_0,s_addr,&reg,1,&v,1,pdMS_TO_TICKS(100));return v;}
static drv_err_t bme280_init(const driver_config_t *cfg){
    if(cfg&&cfg->i2c_addr)s_addr=cfg->i2c_addr;
    i2c_config_t c={.mode=I2C_MODE_MASTER,.sda_io_num=cfg?cfg->i2c_sda:21,.scl_io_num=cfg?cfg->i2c_scl:22,.sda_pullup_en=GPIO_PULLUP_ENABLE,.scl_pullup_en=GPIO_PULLUP_ENABLE,.master.clk_speed=100000};
    if(i2c_param_config(I2C_NUM_0,&c)!=ESP_OK||i2c_driver_install(I2C_NUM_0,c.mode,0,0,0)!=ESP_OK){ESP_LOGE(TAG,"I2C failed");return DRV_ERR_BUS;}
    s_ready=(i2c_read_reg(0xD0)==0x60);ESP_LOGI(TAG,"BME280 I2C 0x%02X ready=%d",s_addr,s_ready);return s_ready?DRV_OK:DRV_ERR_NOT_FOUND;
}
static drv_err_t bme280_read(driver_value_t *v,uint8_t *n){
    if(!s_ready||!v||!n){return DRV_ERR_STATE;}*n=3;
    int32_t t=((int32_t)i2c_read_reg(0xFA)<<12)|((int32_t)i2c_read_reg(0xFB)<<4)|(i2c_read_reg(0xFC)>>4);
    int32_t h=((int32_t)i2c_read_reg(0xFD)<<8)|i2c_read_reg(0xFE);
    int32_t p=((int32_t)i2c_read_reg(0xF7)<<12)|((int32_t)i2c_read_reg(0xF8)<<4)|(i2c_read_reg(0xF9)>>4);
    s_temp=t/100.0f;s_hum=h/1024.0f;s_pres=p/25600.0f;
    strcpy(v[0].key,"temperature");v[0].type=DRV_VAL_NUMBER;v[0].number_value=s_temp;
    strcpy(v[1].key,"humidity");v[1].type=DRV_VAL_NUMBER;v[1].number_value=s_hum;
    strcpy(v[2].key,"pressure");v[2].type=DRV_VAL_NUMBER;v[2].number_value=s_pres;
    return DRV_OK;
}
static drv_err_t bme280_command(const char *a,const void *b){(void)a;(void)b;return DRV_ERR_NOT_SUPP;}
static drv_err_t bme280_deinit(void){s_ready=false;return DRV_OK;}
static driver_t drv_bme280={.name="BME280",.init=bme280_init,.read=bme280_read,.command=bme280_command,.deinit=bme280_deinit};
IO_DRIVER_REGISTER(drv_bme280);
