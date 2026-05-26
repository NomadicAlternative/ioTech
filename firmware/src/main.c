#include <stdio.h>
#include "esp_log.h"
#include "nvs_flash.h"
#include "nvs_storage.h"
#include "state_machine.h"
#include "esp_netif.h"
#include "esp_event.h"
#include "relay_controller.h"
#include "io_driver.h"
#include "io_board.h"

/* Manual driver registration — required when IO_DRIVER_MANUAL_REGISTRY is set.
 * Include all linked driver vtable declarations. */
#ifdef __cplusplus
extern "C" {
#endif
extern void user_setup(void);
#ifdef __cplusplus
}
#endif
#ifdef IO_DRIVER_MANUAL_REGISTRY
extern const driver_t drv_dht22;
extern const driver_t drv_relay;
extern const driver_t drv_bme280;
extern const driver_t drv_ds18b20;
extern const driver_t drv_pir;
extern const driver_t drv_hcsr04;
extern const driver_t drv_ws2812b;
extern const driver_t drv_servo;
extern const driver_t drv_ssd1306;
extern const driver_t drv_lcd1602;
#endif

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

    /* Initialize board pin map (compile-time resolved via -DBOARD_*) */
    io_board_init();

    /* Initialize io_driver engine — auto-discovers or manually registers all linked drivers */
    io_driver_init();

#ifdef IO_DRIVER_MANUAL_REGISTRY
    /* Register compiled-in drivers manually.
     * Only drivers with compiled hardware support are registered.
     * Additional drivers are added to the build when needed (then delivered via OTA). */
    extern const driver_t *g_drv_dht22;
    extern const driver_t *g_drv_relay;
    extern const driver_t *g_drv_lcd1602_i2c;
    io_driver_register(g_drv_dht22);
    io_driver_register(g_drv_relay);
    io_driver_register(g_drv_lcd1602_i2c);
#endif

    /* Initialize relay GPIOs — shim delegates to io_driver */
    relay_controller_init();

    /* Call user_setup from user_app.cpp — initializes user-specified drivers */
    user_setup();

    /* Start the central state machine task — it drives everything from here */
    sm_start();
}
