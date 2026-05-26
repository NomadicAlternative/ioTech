#include "drv_rfid_rc522.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>
static const char *TAG="drv_rfid_rc522"; static bool s_ready=false; static char s_uid[32];
static drv_err_t rfid_init(const driver_config_t *cfg){(void)cfg;s_ready=true;ESP_LOGI(TAG,"RFID RC522 (SPI) ready");s_uid[0]=0;return DRV_OK;}
static drv_err_t rfid_read(driver_value_t *v,uint8_t *n){if(!s_ready||!v||!n){return DRV_ERR_STATE;}*n=2;strcpy(v[0].key,"uid");v[0].type=DRV_VAL_STRING;strncpy(v[0].string_value,s_uid[0]?s_uid:"",sizeof(v[0].string_value));strcpy(v[1].key,"present");v[1].type=DRV_VAL_BOOL;v[1].bool_value=s_uid[0]!=0;return DRV_OK;}
static drv_err_t rfid_command(const char *a,const void *b){(void)a;(void)b;return DRV_ERR_NOT_SUPP;}
static drv_err_t rfid_deinit(void){s_ready=false;return DRV_OK;}
static driver_t drv_rfid_rc522={.name="RFID-RC522",.init=rfid_init,.read=rfid_read,.command=rfid_command,.deinit=rfid_deinit};
IO_DRIVER_REGISTER(drv_rfid_rc522);
