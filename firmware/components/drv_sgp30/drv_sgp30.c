#include "drv_sgp30.h"
#include "driver/i2c.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>
static const char *TAG="drv_sgp30"; static uint8_t s_addr=0x58; static bool s_ready=false; static uint16_t s_eco2=400,s_tvoc=0;
static esp_err_t sgp30_cmd(uint16_t cmd,uint8_t *d,size_t len,uint32_t wait_ms){uint8_t c[3]={cmd>>8,cmd&0xFF,wait_ms>0?0x00:0};if(wait_ms>0){uint8_t b[2]={cmd>>8,cmd&0xFF};i2c_master_write_to_device(I2C_NUM_0,s_addr,b,2,pdMS_TO_TICKS(100));vTaskDelay(pdMS_TO_TICKS(wait_ms));}i2c_master_write_read_device(I2C_NUM_0,s_addr,c,3,d,len,pdMS_TO_TICKS(100));return ESP_OK;}
static drv_err_t sgp30_init(const driver_config_t *cfg){
    if(cfg&&cfg->i2c_addr)s_addr=cfg->i2c_addr;s_ready=true;
    i2c_config_t c={.mode=I2C_MODE_MASTER,.sda_io_num=cfg?cfg->i2c_sda:21,.scl_io_num=cfg?cfg->i2c_scl:22,.sda_pullup_en=GPIO_PULLUP_ENABLE,.scl_pullup_en=GPIO_PULLUP_ENABLE,.master.clk_speed=100000};
    i2c_param_config(I2C_NUM_0,&c);i2c_driver_install(I2C_NUM_0,c.mode,0,0,0);
    uint8_t f[3];sgp30_cmd(0x2003,f,3,0);ESP_LOGI(TAG,"SGP30 I2C 0x%02X",s_addr);return DRV_OK;
}
static drv_err_t sgp30_read(driver_value_t *v,uint8_t *n){
    if(!s_ready||!v||!n){return DRV_ERR_STATE;}*n=2;
    uint8_t d[6]={0};sgp30_cmd(0x2008,d,6,12);
    s_eco2=(d[0]<<8)|d[1];s_tvoc=(d[3]<<8)|d[4];
    strcpy(v[0].key,"eco2");v[0].type=DRV_VAL_NUMBER;v[0].number_value=s_eco2;
    strcpy(v[1].key,"tvoc");v[1].type=DRV_VAL_NUMBER;v[1].number_value=s_tvoc;
    return DRV_OK;
}
static drv_err_t sgp30_command(const char *a,const void *b){(void)a;(void)b;return DRV_ERR_NOT_SUPP;}
static drv_err_t sgp30_deinit(void){s_ready=false;return DRV_OK;}
static driver_t drv_sgp30={.name="SGP30",.init=sgp30_init,.read=sgp30_read,.command=sgp30_command,.deinit=sgp30_deinit};
IO_DRIVER_REGISTER(drv_sgp30);
