#include <stdio.h>
#include "esp_log.h"
#include "nvs_flash.h"
#include "nvs_storage.h"
#include "state_machine.h"
#include "esp_netif.h"
#include "esp_event.h"
#include "relay_controller.h"
#include "io_driver.h"
#include "cJSON.h"

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
    if (ret == ESP_ERR_INVALID_ARG) {
        /* ESP-IDF 5.x may attempt NVS encryption via eFuse on some chip revisions.
         * If flash encryption is not enabled, fall back to unencrypted NVS init. */
        ESP_LOGW(TAG, "NVS encryption not available, falling back to plain NVS...");
        ret = nvs_flash_init_partition("nvs");
    }
    ESP_ERROR_CHECK(ret);

    ESP_LOGI(TAG, "NVS initialized");

    /* Initialize TCP/IP stack and default event loop — required before any
     * WiFi or netif operations (esp_netif_create_default_wifi_ap/sta) */
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());

    /* Initialize relay GPIOs — all OFF before anything else */
    relay_controller_init();

    /* Activate drivers from provisioning config stored in NVS */
    char drivers_buf[1024] = {0};
    if (nvs_load_drivers_config(drivers_buf, sizeof(drivers_buf)) == ESP_OK) {
        cJSON *drivers = cJSON_Parse(drivers_buf);
        if (drivers) {
            int count = driver_activate_all(drivers);
            ESP_LOGI(TAG, "Activated %d driver(s) from provisioning config", count);
            cJSON_Delete(drivers);
        }
    }

    /* Start the central state machine task — it drives everything from here */
    sm_start();
}
