#include "drv_modbus.h"
#include "io_board.h"
#include "driver/uart.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>
static const char *TAG="drv_modbus"; static bool s_ready=false; static uint16_t s_reg=0;
static uint16_t crc16(const uint8_t *d,int len){uint16_t crc=0xFFFF;for(int i=0;i<len;i++){crc^=d[i];for(int j=0;j<8;j++)crc=(crc&1)?(crc>>1)^0xA001:crc>>1;}return crc;}
static drv_err_t modbus_init(const driver_config_t *cfg){(void)cfg;uart_config_t uc={.baud_rate=9600,.data_bits=UART_DATA_8_BITS,.parity=UART_PARITY_DISABLE,.stop_bits=UART_STOP_BITS_1,.flow_ctrl=UART_HW_FLOWCTRL_DISABLE};uart_param_config(BOARD_UART_NUM,&uc);uart_set_pin(BOARD_UART_NUM,cfg?cfg->gpio:16,cfg?cfg->gpio2:17,UART_PIN_NO_CHANGE,UART_PIN_NO_CHANGE);uart_driver_install(BOARD_UART_NUM,256,0,0,NULL,0);s_ready=true;ESP_LOGI(TAG,"Modbus RTU");return DRV_OK;}
static drv_err_t modbus_read(driver_value_t *v,uint8_t *n){if(!s_ready||!v||!n){return DRV_ERR_STATE;}*n=1;uint8_t req[]={0x01,0x03,0x00,0x00,0x00,0x01};uint16_t c=crc16(req,6);req[6]=c&0xFF;req[7]=c>>8;uart_write_bytes(BOARD_UART_NUM,req,8);uint8_t rsp[7]={0};uart_read_bytes(BOARD_UART_NUM,rsp,7,pdMS_TO_TICKS(200));if(rsp[1]==0x03)s_reg=(rsp[3]<<8)|rsp[4];strcpy(v[0].key,"register_value");v[0].type=DRV_VAL_NUMBER;v[0].number_value=s_reg;return DRV_OK;}
static drv_err_t modbus_command(const char *a,const void *b){(void)a;(void)b;return DRV_ERR_NOT_SUPP;}
static drv_err_t modbus_deinit(void){s_ready=false;uart_driver_delete(BOARD_UART_NUM);return DRV_OK;}
static driver_t drv_modbus={.name="MODBUS",.init=modbus_init,.read=modbus_read,.command=modbus_command,.deinit=modbus_deinit};
IO_DRIVER_REGISTER(drv_modbus);
