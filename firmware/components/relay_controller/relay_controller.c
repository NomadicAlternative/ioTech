/**
 * @file relay_controller.c
 * @brief RELAY controller — SHIM for one release.
 *
 * io_driver engine handles relay init + commands via drv_relay.
 * This shim maintains backward compatibility with main.c and
 * any legacy code that calls relay_set() / relay_get().
 *
 * @deprecated  Use io_driver_dispatch_command("relay", ...) directly.
 *              This shim will be removed in the release after io_driver ships.
 */
#include "relay_controller.h"
#include "io_driver.h"
#include "cJSON.h"
#include "esp_log.h"

static const char *TAG = "relay_shim";

void relay_controller_init(void)
{
    /* io_driver engine handles relay init now.
     * If RELAY driver is active, it's already initialized.
     * Otherwise, do nothing — no relay GPIOs to configure. */
    if (io_driver_active_count() == 0) {
        ESP_LOGW(TAG, "io_driver not yet initialized — relay shim has no effect");
    } else {
        ESP_LOGI(TAG, "io_driver active (%u drivers) — relay init delegated",
                 io_driver_active_count());
    }
}

esp_err_t relay_set(uint8_t relay_num, bool on)
{
    /* Build cJSON arg matching the RELAY driver's expected format */
    cJSON *arg = cJSON_CreateObject();
    if (!arg) return ESP_FAIL;

    cJSON_AddNumberToObject(arg, "relay", relay_num);
    cJSON_AddStringToObject(arg, "state", on ? "on" : "off");

    drv_err_t err = io_driver_dispatch_command("relay", arg);
    cJSON_Delete(arg);

    if (err == DRV_ERR_NOT_FOUND) {
        ESP_LOGW(TAG, "RELAY driver not loaded — relay_set(%u, %s) ignored",
                 relay_num, on ? "on" : "off");
    } else if (err != DRV_OK) {
        ESP_LOGW(TAG, "relay_set(%u, %s) failed: %s",
                 relay_num, on ? "on" : "off", drv_err_str(err));
    }

    return (err == DRV_OK) ? ESP_OK : ESP_FAIL;
}

bool relay_get(uint8_t relay_num)
{
    /* Read shadow state from the io_driver engine via collect */
    /*
     * Note: In the shim, we approximate relay state by checking
     * the current telemetry from the RELAY driver. This is a
     * best-effort shim — after the shim is removed, callers
     * will use io_driver API directly instead.
     */
    cJSON *payload = io_driver_collect_all();
    if (!payload) return false;

    char key[32];
    snprintf(key, sizeof(key), "relay%u", relay_num);
    cJSON *item = cJSON_GetObjectItem(payload, key);

    bool result = false;
    if (cJSON_IsBool(item)) {
        result = cJSON_IsTrue(item);
    } else if (cJSON_IsNumber(item)) {
        result = (item->valueint != 0);
    }

    cJSON_Delete(payload);
    return result;
}
