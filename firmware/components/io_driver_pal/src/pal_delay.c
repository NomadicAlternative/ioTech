/**
 * @file pal_delay.c
 * @brief PAL delay — wraps esp_rom_delay_us and vTaskDelay.
 */
#include "pal_delay.h"
#include "rom/ets_sys.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

void pal_delay_us(uint32_t us)
{
    ets_delay_us(us);
}

void pal_delay_ms(uint32_t ms)
{
    vTaskDelay(pdMS_TO_TICKS(ms));
}
