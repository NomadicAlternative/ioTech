#include "drv_pms5003.h"
#include "io_board.h"
#include "driver/uart.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>
static const char *TAG="drv_pms5003"; static bool s_ready=false; static uint16_t s_pm1=0,s_pm25=0,s_pm10=0;
static drv_err_t pms5003_init(const driver_config_t *cfg){(void)cfg;uart_config_t uc={.baud_rate=9600,.data_bits=UART_DATA_8_BITS,.parity=UART_PARITY_DISABLE,.stop_bits=UART_STOP_BITS_1,.flow_ctrl=UART_HW_FLOWCTRL_DISABLE};uart_param_config(BOARD_UART_NUM,&uc);uart_set_pin(BOARD_UART_NUM,cfg?cfg->gpio:16,cfg?cfg->gpio2:17,UART_PIN_NO_CHANGE,UART_PIN_NO_CHANGE);uart_driver_install(BOARD_UART_NUM,512,0,0,NULL,0);s_ready=true;ESP_LOGI(TAG,"PMS5003 UART");return DRV_OK;}
static drv_err_t pms5003_read(driver_value_t *v,uint8_t *n){if(!s_ready||!v||!n){return DRV_ERR_STATE;}*n=3;uint8_t d[32]={0};int rd=uart_read_bytes(BOARD_UART_NUM,d,32,pdMS_TO_TICKS(2000));if(rd>=32&&d[0]==0x42&&d[1]==0x4d){s_pm1=(d[10]<<8)|d[11];s_pm25=(d[12]<<8)|d[13];s_pm10=(d[14]<<8)|d[15];}strcpy(v[0].key,"pm1_0");v[0].type=DRV_VAL_NUMBER;v[0].number_value=s_pm1;strcpy(v[1].key,"pm2_5");v[1].type=DRV_VAL_NUMBER;v[1].number_value=s_pm25;strcpy(v[2].key,"pm10");v[2].type=DRV_VAL_NUMBER;v[2].number_value=s_pm10;return DRV_OK;}
static drv_err_t pms5003_command(const char *a,const void *b){(void)a;(void)b;return DRV_ERR_NOT_SUPP;}
static drv_err_t pms5003_deinit(void){s_ready=false;uart_driver_delete(BOARD_UART_NUM);return DRV_OK;}
static driver_t drv_pms5003={.name="PMS5003",.init=pms5003_init,.read=pms5003_read,.command=pms5003_command,.deinit=pms5003_deinit};
IO_DRIVER_REGISTER(drv_pms5003);
