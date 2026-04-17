#pragma once

#include "esp_err.h"
#include "nvs_storage.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Result codes for provisioning HTTP calls.
 */
typedef enum {
    PROV_RESULT_OK       = 0,  /**< 200 — device_token received and stored */
    PROV_RESULT_CONFLICT = 1,  /**< 409 — already provisioned */
    PROV_RESULT_INVALID  = 2,  /**< 422 — bad claim_token */
    PROV_RESULT_ERROR    = 3,  /**< Network error or unexpected status */
} prov_result_t;

/**
 * @brief POST to {backend_url}/api/provisioning with hardware_id and claim_token.
 *
 * On HTTP 200, parses device_token, tenant_id, device_id, mqtt_broker_url
 * from JSON response and stores them in NVS.
 *
 * @param cfg  device_config_t with backend_url, hardware_id, claim_token populated.
 * @return     prov_result_t indicating outcome.
 */
prov_result_t provisioning_client_register(device_config_t *cfg);

/**
 * @brief Build the MQTT topic string for a given sub-topic.
 *
 * Pattern: org/{tenant_id}/device/{device_id}/{subtopic}
 *
 * @param cfg      Device config with tenant_id and device_id populated.
 * @param subtopic Sub-topic suffix (e.g. "telemetry", "status", "ota/notify").
 * @param out      Output buffer.
 * @param out_len  Output buffer size.
 * @return         ESP_OK on success; ESP_ERR_INVALID_ARG if output buffer too small.
 */
esp_err_t provisioning_build_topic(const device_config_t *cfg,
                                   const char *subtopic,
                                   char *out, size_t out_len);

#ifdef __cplusplus
}
#endif
