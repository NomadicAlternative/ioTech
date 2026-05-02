/**
 * @file mqtt_manager.h
 * @brief MQTT client manager for telemetry, status, and OTA notifications.
 *
 * Connects to the broker using device_id as client_id and device_token
 * as password (TLS). Publishes an LWT "offline" message on the status
 * topic and subscribes to the ota/notify topic.
 */
#pragma once

#include "esp_err.h"
#include "nvs_storage.h"

#ifdef __cplusplus
extern "C" {
#endif

/** Callback invoked when an OTA notification arrives via MQTT */
typedef void (*mqtt_ota_cb_t)(const char *url);

/**
 * @brief Start the MQTT manager and connect to the broker.
 *
 * Connects using device_id as client_id and device_token as password.
 * Publishes LWT = "offline" on status topic (QoS 1, retain).
 * Subscribes to ota/notify.
 * Sends SM_EVT_MQTT_CONNECTED on success.
 *
 * @param cfg  Device config with mqtt_broker_url, device_id, device_token populated.
 */
void mqtt_manager_start(const device_config_t *cfg);

/**
 * @brief Stop and disconnect the MQTT client.
 */
void mqtt_manager_stop(void);

/**
 * @brief Publish a telemetry JSON payload.
 *
 * Topic: org/{tenant_id}/device/{device_id}/telemetry, QoS 0.
 *
 * @param json_payload  Null-terminated JSON string.
 * @return ESP_OK on success.
 */
esp_err_t mqtt_publish_telemetry(const char *json_payload);

/**
 * @brief Publish a status message.
 *
 * Topic: org/{tenant_id}/device/{device_id}/status, QoS 1, retain.
 *
 * @param status  Status string (e.g. "online", "offline").
 * @return ESP_OK on success.
 */
esp_err_t mqtt_publish_status(const char *status);

/**
 * @brief Register callback for OTA notifications.
 *
 * The callback is invoked with the firmware download URL when a message
 * arrives on the ota/notify topic.
 *
 * @param cb  Callback function pointer.
 */
void mqtt_subscribe_ota_notify(mqtt_ota_cb_t cb);

#ifdef __cplusplus
}
#endif
