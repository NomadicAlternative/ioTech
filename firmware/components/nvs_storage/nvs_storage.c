#include <string.h>
#include "esp_log.h"
#include "nvs_flash.h"
#include "nvs.h"
#include "nvs_storage.h"

static const char *TAG        = "nvs_storage";
static const char *NVS_NS     = "iotech";        /* NVS namespace */

/* -----------------------------------------------------------------------
 * NVS key constants
 * --------------------------------------------------------------------- */
#define KEY_WIFI_SSID       "wifi_ssid"
#define KEY_WIFI_PASS       "wifi_pass"
#define KEY_DEVICE_TOKEN    "device_token"
#define KEY_TENANT_ID       "tenant_id"
#define KEY_DEVICE_ID       "device_id"
#define KEY_MQTT_URL        "mqtt_url"
#define KEY_MQTT_USER       "mqtt_user"
#define KEY_MQTT_PASS       "mqtt_pass"
#define KEY_BACKEND_URL     "backend_url"
#define KEY_CLAIM_TOKEN     "claim_token"
#define KEY_HW_ID           "hardware_id"
#define KEY_FW_VERSION      "fw_version"

/* -----------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------- */
static esp_err_t nvs_write_str(nvs_handle_t handle, const char *key, const char *value)
{
    esp_err_t err = nvs_set_str(handle, key, value);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "nvs_set_str(%s) failed: %s", key, esp_err_to_name(err));
    }
    return err;
}

static esp_err_t nvs_read_str(nvs_handle_t handle, const char *key, char *out, size_t max_len)
{
    size_t required_len = max_len;
    esp_err_t err = nvs_get_str(handle, key, out, &required_len);
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "nvs_get_str(%s) failed: %s", key, esp_err_to_name(err));
    }
    return err;
}

/* -----------------------------------------------------------------------
 * Public API
 * --------------------------------------------------------------------- */

esp_err_t nvs_store_credentials(const wifi_creds_t *creds)
{
    if (!creds) return ESP_ERR_INVALID_ARG;

    nvs_handle_t h;
    esp_err_t err = nvs_open(NVS_NS, NVS_READWRITE, &h);
    if (err != ESP_OK) return err;

    err = nvs_write_str(h, KEY_WIFI_SSID, creds->ssid);
    if (err == ESP_OK) err = nvs_write_str(h, KEY_WIFI_PASS, creds->password);
    if (err == ESP_OK) err = nvs_commit(h);

    nvs_close(h);
    return err;
}

esp_err_t nvs_load_credentials(wifi_creds_t *out)
{
    if (!out) return ESP_ERR_INVALID_ARG;

    nvs_handle_t h;
    esp_err_t err = nvs_open(NVS_NS, NVS_READONLY, &h);
    if (err != ESP_OK) return err;

    err = nvs_read_str(h, KEY_WIFI_SSID, out->ssid, sizeof(out->ssid));
    if (err == ESP_OK) {
        err = nvs_read_str(h, KEY_WIFI_PASS, out->password, sizeof(out->password));
    }

    nvs_close(h);
    return err;
}

esp_err_t nvs_store_device_config(const device_config_t *cfg)
{
    if (!cfg) return ESP_ERR_INVALID_ARG;

    nvs_handle_t h;
    esp_err_t err = nvs_open(NVS_NS, NVS_READWRITE, &h);
    if (err != ESP_OK) return err;

    if (err == ESP_OK) err = nvs_write_str(h, KEY_DEVICE_TOKEN,  cfg->device_token);
    if (err == ESP_OK) err = nvs_write_str(h, KEY_TENANT_ID,     cfg->tenant_id);
    if (err == ESP_OK) err = nvs_write_str(h, KEY_DEVICE_ID,     cfg->device_id);
    if (err == ESP_OK) err = nvs_write_str(h, KEY_MQTT_URL,      cfg->mqtt_broker_url);
    if (err == ESP_OK && cfg->mqtt_username[0]) err = nvs_write_str(h, KEY_MQTT_USER, cfg->mqtt_username);
    if (err == ESP_OK && cfg->mqtt_password[0]) err = nvs_write_str(h, KEY_MQTT_PASS, cfg->mqtt_password);
    if (err == ESP_OK) err = nvs_write_str(h, KEY_BACKEND_URL,   cfg->backend_url);
    if (err == ESP_OK) err = nvs_write_str(h, KEY_HW_ID,         cfg->hardware_id);

    /* Claim token and firmware version are optional — ignore not-found errors */
    if (cfg->claim_token[0] != '\0') {
        nvs_write_str(h, KEY_CLAIM_TOKEN, cfg->claim_token);
    }
    if (cfg->firmware_version[0] != '\0') {
        nvs_write_str(h, KEY_FW_VERSION, cfg->firmware_version);
    }

    if (err == ESP_OK) err = nvs_commit(h);

    nvs_close(h);
    return err;
}

esp_err_t nvs_load_device_config(device_config_t *out)
{
    if (!out) return ESP_ERR_INVALID_ARG;

    nvs_handle_t h;
    esp_err_t err = nvs_open(NVS_NS, NVS_READONLY, &h);
    if (err != ESP_OK) return err;

    /* Post-provisioning fields — only present after HTTP provisioning completes */
    nvs_read_str(h, KEY_DEVICE_TOKEN,  out->device_token,    sizeof(out->device_token));
    nvs_read_str(h, KEY_TENANT_ID,     out->tenant_id,       sizeof(out->tenant_id));
    nvs_read_str(h, KEY_DEVICE_ID,     out->device_id,       sizeof(out->device_id));
    nvs_read_str(h, KEY_MQTT_URL,      out->mqtt_broker_url, sizeof(out->mqtt_broker_url));
    nvs_read_str(h, KEY_MQTT_USER,     out->mqtt_username,   sizeof(out->mqtt_username));
    nvs_read_str(h, KEY_MQTT_PASS,     out->mqtt_password,   sizeof(out->mqtt_password));

    /* Always present after captive portal — needed for HTTP provisioning */
    err = nvs_read_str(h, KEY_BACKEND_URL, out->backend_url, sizeof(out->backend_url));

    /* Optional fields */
    nvs_read_str(h, KEY_HW_ID,         out->hardware_id,      sizeof(out->hardware_id));
    nvs_read_str(h, KEY_CLAIM_TOKEN,   out->claim_token,      sizeof(out->claim_token));
    nvs_read_str(h, KEY_FW_VERSION,    out->firmware_version, sizeof(out->firmware_version));

    nvs_close(h);
    return err;
}

esp_err_t nvs_storage_erase_all(void)
{
    nvs_handle_t h;
    esp_err_t err = nvs_open(NVS_NS, NVS_READWRITE, &h);
    if (err != ESP_OK) return err;

    /* NOTE: nvs_erase_all(handle) is the ESP-IDF API, not a recursive call */
    err = nvs_erase_all(h);
    if (err == ESP_OK) err = nvs_commit(h);

    nvs_close(h);
    ESP_LOGI(TAG, "NVS namespace '%s' erased", NVS_NS);
    return err;
}
