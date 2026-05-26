#include "drv_rs485.h"
#include "io_board.h"
#include "driver/uart.h"
#include "driver/gpio.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>
static const char *TAG="drv_rs485"; static bool s_ready=false; static uint8_t s_de=255; static char s_data[64];
static drv_err_t rs485_init(const driver_config_t *cfg){if(cfg&&cfg->gpio!=DRV_GPIO_NONE)s_de=cfg->gpio;if(s_de!=255){gpio_config_t c={.pin_bit_mask=(1ULL<<s_de),.mode=GPIO_MODE_OUTPUT};gpio_config(&c);gpio_set_level(s_de,0);}uart_config_t uc={.baud_rate=9600,.data_bits=UART_DATA_8_BITS,.parity=UART_PARITY_DISABLE,.stop_bits=UART_STOP_BITS_1,.flow_ctrl=UART_HW_FLOWCTRL_DISABLE};uart_param_config(BOARD_UART_NUM,&uc);uart_set_pin(BOARD_UART_NUM,cfg?cfg->gpio2:16,cfg?cfg->gpio:17,UART_PIN_NO_CHANGE,UART_PIN_NO_CHANGE);uart_driver_install(BOARD_UART_NUM,256,0,0,NULL,0);s_ready=true;ESP_LOGI(TAG,"RS485 DE=%u",s_de);return DRV_OK;}
static drv_err_t rs485_read(driver_value_t *v,uint8_t *n){if(!s_ready||!v||!n){return DRV_ERR_STATE;}*n=1;int len=uart_read_bytes(BOARD_UART_NUM,(uint8_t*)s_data,63,pdMS_TO_TICKS(100));s_data[len]=0;strcpy(v[0].key,"data");v[0].type=DRV_VAL_STRING;strncpy(v[0].string_value,s_data,sizeof(v[0].string_value));return DRV_OK;}
static drv_err_t rs485_command(const char *a,const void *b){const cJSON *j=(const cJSON*)b;const cJSON *txt=cJSON_GetObjectItem(j,"data");if(txt&&cJSON_IsString(txt)&&s_de!=255){gpio_set_level(s_de,1);uart_write_bytes(BOARD_UART_NUM,txt->valuestring,strlen(txt->valuestring));uart_wait_tx_done(BOARD_UART_NUM,pdMS_TO_TICKS(100));gpio_set_level(s_de,0);}(void)a;return DRV_OK;}
static drv_err_t rs485_deinit(void){s_ready=false;uart_driver_delete(BOARD_UART_NUM);return DRV_OK;}
static driver_t drv_rs485={.name="RS485",.init=rs485_init,.read=rs485_read,.command=rs485_command,.deinit=rs485_deinit};
IO_DRIVER_REGISTER(drv_rs485);
