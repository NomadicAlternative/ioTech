/** @file drv_hcsr04.c — HC-SR04 ultrasonic distance sensor. */
#include "drv_hcsr04.h"
#include "pal_gpio.h"
#include "pal_delay.h"
#include "pal_timer.h"
#include "esp_log.h"
#include <string.h>
static const char *TAG = "drv_hcsr04";
static uint8_t s_trig = DRV_GPIO_NONE, s_echo = DRV_GPIO_NONE;
static bool s_ready = false;

static drv_err_t hcsr04_init(const driver_config_t *cfg) {
    if(!cfg||cfg->gpio==DRV_GPIO_NONE) return DRV_ERR_ARG;
    s_trig=cfg->gpio; s_echo=cfg->gpio2;
    pal_gpio_set_direction(s_trig,PAL_GPIO_OUTPUT);
    pal_gpio_set_level(s_trig,0);
    if(s_echo!=DRV_GPIO_NONE) pal_gpio_set_direction(s_echo,PAL_GPIO_INPUT);
    s_ready=true;
    ESP_LOGI(TAG,"HC-SR04 trig=%u echo=%u",s_trig,s_echo);
    return DRV_OK;
}
static drv_err_t hcsr04_read(driver_value_t *values, uint8_t *count) {
    if(!s_ready||!values||!count) return DRV_ERR_STATE;
    *count=0;
    /* 10µs trigger pulse */
    pal_gpio_set_level(s_trig,1); pal_delay_us(10); pal_gpio_set_level(s_trig,0);
    if(s_echo==DRV_GPIO_NONE) {
        ESP_LOGW(TAG,"No echo pin (C3 timer fallback not yet implemented)");
        return DRV_ERR_NOT_SUPP;
    }
    /* Wait for echo HIGH with 30ms timeout */
    uint64_t start=pal_timer_get_us(); uint8_t level;
    while(1){pal_gpio_get_level(s_echo,&level); if(level)break; if(pal_timer_get_us()-start>30000)return DRV_ERR_TIMEOUT;}
    start=pal_timer_get_us();
    while(1){pal_gpio_get_level(s_echo,&level); if(!level)break; if(pal_timer_get_us()-start>30000)return DRV_ERR_TIMEOUT;}
    uint64_t pulse=pal_timer_get_us()-start;
    double distance=pulse/58.0;
    strncpy(values[0].key,"distance",31);
    values[0].type=DRV_VAL_NUMBER; values[0].number_value=distance;
    *count=1;
    return DRV_OK;
}
static drv_err_t hcsr04_command(const char *action, const void *arg) { (void)action;(void)arg; return DRV_ERR_NOT_SUPP; }
static drv_err_t hcsr04_deinit(void) { s_ready=false; return DRV_OK; }

const driver_t drv_hcsr04 = { .name="HC-SR04", .init=hcsr04_init, .read=hcsr04_read, .command=hcsr04_command, .deinit=hcsr04_deinit };
IO_DRIVER_REGISTER(drv_hcsr04);
