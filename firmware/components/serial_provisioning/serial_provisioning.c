#include <string.h>
#include <stdio.h>
#include <stdbool.h>
#include "esp_log.h"
#include "driver/uart.h"
#include "cJSON.h"
#include "nvs_storage.h"
#include "serial_provisioning.h"

static const char *TAG = "serial_prov";

/* UART configuration */
#define PROV_UART_NUM       UART_NUM_0
#define PROV_UART_BUF_SIZE  512
#define PROV_LINE_MAX       480   /* max bytes we read before giving up */

/* -----------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------- */

/**
 * Read bytes from UART looking for a line that starts with '{'.
 * Skips any garbage before the '{' (bootloader noise).
 * Returns number of bytes in buf (excluding null terminator), 0 on timeout.
 */
static int read_json_line(char *buf, int max_len, int timeout_ms)
{
    int pos = 0;
    bool in_json = false;
    int elapsed = 0;
    const int poll_ms = 20;

    while (elapsed < timeout_ms && pos < max_len - 1) {
        uint8_t byte;
        int n = uart_read_bytes(PROV_UART_NUM, &byte, 1,
                                pdMS_TO_TICKS(poll_ms));
        elapsed += poll_ms;

        if (n <= 0) continue;

        /* Start accumulating when we see '{' */
        if (!in_json) {
            if (byte == '{') {
                in_json = true;
                buf[pos++] = '{';
            }
            continue;
        }

        /* We are inside the JSON */
        if (byte == '\n' || byte == '\r') {
            break;   /* end of line — done */
        }

        buf[pos++] = (char)byte;
    }

    buf[pos] = '\0';
    return (in_json && pos > 1) ? pos : 0;
}

static const char *json_str(cJSON *obj, const char *key)
{
    cJSON *item = cJSON_GetObjectItemCaseSensitive(obj, key);
    if (!item || !cJSON_IsString(item)) return NULL;
    return item->valuestring;
}

/* -----------------------------------------------------------------------
 * Public API
 * --------------------------------------------------------------------- */

bool serial_provisioning_receive(void)
{
    /* Configure UART0 for reading — TX/RX on default pins (1/3) */
    uart_config_t cfg = {
        .baud_rate  = 115200,
        .data_bits  = UART_DATA_8_BITS,
        .parity     = UART_PARITY_DISABLE,
        .stop_bits  = UART_STOP_BITS_1,
        .flow_ctrl  = UART_HW_FLOWCTRL_DISABLE,
    };
    uart_param_config(PROV_UART_NUM, &cfg);
    uart_driver_install(PROV_UART_NUM, PROV_UART_BUF_SIZE * 2, 0, 0, NULL, 0);

    ESP_LOGI(TAG, "Waiting %d ms for serial provisioning data...", SERIAL_PROV_TIMEOUT_MS);

    char line[PROV_LINE_MAX] = {0};
    int len = read_json_line(line, sizeof(line), SERIAL_PROV_TIMEOUT_MS);

    uart_driver_delete(PROV_UART_NUM);

    if (len == 0) {
        ESP_LOGI(TAG, "No serial data received — falling back to captive portal");
        return false;
    }

    ESP_LOGI(TAG, "Received %d bytes: [%s]", len, line);

    cJSON *root = cJSON_Parse(line);
    if (!root) {
        ESP_LOGW(TAG, "JSON parse error — falling back to captive portal");
        return false;
    }

    const char *ssid         = json_str(root, "wifi_ssid");
    const char *password     = json_str(root, "wifi_password");
    const char *backend_url  = json_str(root, "backend_url");
    const char *mqtt_url     = json_str(root, "mqtt_url");
    const char *device_token = json_str(root, "device_token");

    if (!ssid || !password || !backend_url || !mqtt_url || !device_token) {
        ESP_LOGW(TAG, "Missing required fields in JSON payload");
        cJSON_Delete(root);
        return false;
    }

    /* Write WiFi credentials */
    wifi_creds_t wifi = {0};
    strlcpy(wifi.ssid,     ssid,     sizeof(wifi.ssid));
    strlcpy(wifi.password, password, sizeof(wifi.password));

    esp_err_t err = nvs_store_credentials(&wifi);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to store WiFi credentials: %s", esp_err_to_name(err));
        cJSON_Delete(root);
        return false;
    }

    /* Write device config */
    device_config_t dev = {0};
    strlcpy(dev.device_token,    device_token, sizeof(dev.device_token));
    strlcpy(dev.backend_url,     backend_url,  sizeof(dev.backend_url));
    strlcpy(dev.mqtt_broker_url, mqtt_url,     sizeof(dev.mqtt_broker_url));

    err = nvs_store_device_config(&dev);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to store device config: %s", esp_err_to_name(err));
        cJSON_Delete(root);
        return false;
    }

    cJSON_Delete(root);
    ESP_LOGI(TAG, "Serial provisioning complete — WiFi: '%s', backend: '%s'", ssid, backend_url);
    return true;
}
