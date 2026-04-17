#include <stdio.h>
#include "esp_log.h"
#include "nvs_flash.h"
#include "nvs_storage.h"
#include "state_machine.h"

static const char *TAG = "main";

void app_main(void)
{
    ESP_LOGI(TAG, "ioTech firmware starting...");

    /* Initialize NVS flash (required before any NVS operations) */
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_LOGW(TAG, "NVS partition needs to be erased, re-initializing...");
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    ESP_LOGI(TAG, "NVS initialized");

    /* Start the central state machine task — it drives everything from here */
    sm_start();
}
