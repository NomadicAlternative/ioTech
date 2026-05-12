/**
 * @file nvs_storage.h
 * @brief Encrypted NVS persistence layer for WiFi credentials and device config.
 *
 * All keys are stored in the "iotech" NVS namespace. Provides typed
 * read/write helpers for wifi_creds_t and device_config_t, plus a
 * factory-reset erase function.
 */
#pragma once

#include <stddef.h>
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/* -----------------------------------------------------------------------
 * Data structures
 * --------------------------------------------------------------------- */

/** WiFi credentials stored in NVS after captive portal provisioning */
typedef struct {
    char ssid[64];      /**< WiFi SSID (null-terminated) */
    char password[64];  /**< WiFi Password (null-terminated) */
} wifi_creds_t;

/** Device configuration stored after successful backend provisioning */
typedef struct {
    char device_token[128];    /**< Bearer token for MQTT auth */
    char tenant_id[64];        /**< Tenant identifier */
    char device_id[64];        /**< Device identifier (UUID) */
    char mqtt_broker_url[128]; /**< Full MQTT broker URL e.g. mqtts://broker.example.com */
    char backend_url[128];     /**< Backend REST API base URL */
    char claim_token[128];     /**< Claim token (cleared after 422 or success) */
    char hardware_id[32];      /**< MAC-derived hardware ID (set at boot) */
    char firmware_version[32]; /**< Last known firmware version after OTA */
} device_config_t;

/* -----------------------------------------------------------------------
 * Public API
 * --------------------------------------------------------------------- */

/**
 * @brief Store WiFi credentials in encrypted NVS.
 */
esp_err_t nvs_store_credentials(const wifi_creds_t *creds);

/**
 * @brief Load WiFi credentials from encrypted NVS.
 * @return ESP_OK if all keys found; ESP_ERR_NVS_NOT_FOUND if missing.
 */
esp_err_t nvs_load_credentials(wifi_creds_t *out);

/**
 * @brief Store device configuration (token, IDs, broker URL) in NVS.
 */
esp_err_t nvs_store_device_config(const device_config_t *cfg);

/**
 * @brief Load device configuration from encrypted NVS.
 * @return ESP_OK if all required keys found; ESP_ERR_NVS_NOT_FOUND if missing.
 */
esp_err_t nvs_load_device_config(device_config_t *out);

/**
 * @brief Erase ALL keys from the NVS namespace (factory reset).
 *
 * @note Renamed from nvs_erase_all() to avoid collision with the ESP-IDF
 *       nvs_erase_all(nvs_handle_t) API.
 */
esp_err_t nvs_storage_erase_all(void);

/**
 * Store/load driver configuration JSON string in NVS.
 */
esp_err_t nvs_store_drivers_config(const char *json_str);
esp_err_t nvs_load_drivers_config(char *buf, size_t buf_size);

#ifdef __cplusplus
}
#endif
