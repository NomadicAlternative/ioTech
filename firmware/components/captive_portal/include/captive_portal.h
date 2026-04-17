#pragma once

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Start the captive portal (SoftAP + DNS + HTTP server).
 *
 * Sets up WiFi in SoftAP mode with SSID pattern "ioTech-{last4hex}",
 * starts a DNS server redirecting all queries to 192.168.4.1, and
 * starts an HTTP server serving the provisioning form.
 *
 * When the user submits a valid form:
 *  - Stores WiFi creds and claim_token via nvs_storage
 *  - Sends SM_EVT_PORTAL_FORM_OK to state machine
 *  - Shuts down the portal
 */
void captive_portal_start(void);

/**
 * @brief Stop and tear down the captive portal.
 */
void captive_portal_stop(void);

#ifdef __cplusplus
}
#endif
