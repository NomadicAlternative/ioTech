/**
 * @file wifi_manager.h
 * @brief WiFi STA connection management.
 *
 * Connects to a network using stored credentials, handles connection
 * timeouts (30 s), and signals the state machine on success or failure.
 */
#pragma once

#include "esp_err.h"
#include "nvs_storage.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Connect to WiFi using the provided credentials.
 *
 * Sends SM_EVT_WIFI_CONNECTED or SM_EVT_WIFI_FAILED to state machine.
 * Times out after 30 seconds.
 *
 * @param creds  WiFi SSID and password.
 */
void wifi_manager_connect(const wifi_creds_t *creds);

/**
 * @brief Disconnect from WiFi (called during state transitions).
 */
void wifi_manager_disconnect(void);

/**
 * @brief Get the assigned IPv4 address as a string (for captive portal DNS redirect).
 *
 * @param buf     Output buffer.
 * @param buf_len Buffer size.
 */
void wifi_manager_get_ip(char *buf, size_t buf_len);

#ifdef __cplusplus
}
#endif
