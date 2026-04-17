#pragma once

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Start the OTA poll task (periodic check every 1 hour by default).
 *
 * The poll interval can be updated via MQTT config topic.
 */
void ota_manager_start_poll(void);

/**
 * @brief Trigger OTA download and flash immediately.
 *
 * Called when an ota/notify MQTT message arrives with a URL, or when
 * the periodic poll detects a newer version.
 *
 * Sends SM_EVT_OTA_COMPLETE on success, SM_EVT_OTA_FAILED on error.
 */
void ota_manager_begin(void);

/**
 * @brief Set the OTA firmware URL for the next ota_manager_begin() call.
 *
 * @param url  Full HTTPS URL to firmware binary.
 */
void ota_manager_set_url(const char *url);

/**
 * @brief Compare two semantic version strings.
 *
 * @param current  Current version string (e.g. "1.2.3").
 * @param latest   Latest version string (e.g. "1.3.0").
 * @return  1 if latest > current, 0 if equal, -1 if latest < current.
 */
int ota_semver_compare(const char *current, const char *latest);

#ifdef __cplusplus
}
#endif
