/**
 * @file captive_portal.h
 * @brief WiFi SoftAP captive portal for device provisioning.
 *
 * Starts a SoftAP with SSID "ioTech-{last4hex}", a DNS server that
 * redirects all queries to 192.168.4.1, and an HTTP server serving
 * the provisioning form from the SPIFFS filesystem.
 */
#pragma once

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Callback invoked when the captive portal form is submitted OK.
 */
typedef void (*captive_portal_on_done_cb_t)(void);

/**
 * @brief Start the captive portal (SoftAP + DNS + HTTP server).
 *
 * Sets up WiFi in SoftAP mode with SSID pattern "ioTech-{last4hex}",
 * starts a DNS server redirecting all queries to 192.168.4.1, and
 * starts an HTTP server serving the provisioning form.
 *
 * When the user submits a valid form:
 *  - Stores WiFi creds and claim_token via nvs_storage
 *  - Invokes on_done callback (if set)
 *  - Shuts down the portal
 *
 * @param on_done  Callback to invoke on successful form submission. May be NULL.
 */
void captive_portal_start(captive_portal_on_done_cb_t on_done);

/**
 * @brief Stop and tear down the captive portal.
 */
void captive_portal_stop(void);

#ifdef __cplusplus
}
#endif
