#pragma once

#include <stdint.h>
#include "esp_err.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"

#ifdef __cplusplus
extern "C" {
#endif

/* -----------------------------------------------------------------------
 * State definitions
 * --------------------------------------------------------------------- */
typedef enum {
    STATE_INIT = 0,
    STATE_PROVISIONING,
    STATE_CONNECTING,
    STATE_NORMAL,
    STATE_OTA_UPDATE,
    STATE_FACTORY_RESET,
    STATE_ERROR,
    STATE_MAX
} sm_state_t;

/* -----------------------------------------------------------------------
 * Event definitions
 * --------------------------------------------------------------------- */
typedef enum {
    SM_EVT_NVS_CREDS_FOUND = 0,     /**< NVS has wifi + device_token */
    SM_EVT_NVS_CREDS_MISSING,       /**< NVS is empty — go to provisioning */
    SM_EVT_PORTAL_FORM_OK,          /**< Captive portal form submitted OK */
    SM_EVT_WIFI_CONNECTED,          /**< WiFi STA got IP */
    SM_EVT_WIFI_FAILED,             /**< WiFi connection timed out */
    SM_EVT_PROV_SUCCESS,            /**< POST /api/provisioning → 200 */
    SM_EVT_PROV_CONFLICT,           /**< POST /api/provisioning → 409 */
    SM_EVT_PROV_INVALID,            /**< POST /api/provisioning → 422 */
    SM_EVT_PROV_FAILED,             /**< POST /api/provisioning → network error */
    SM_EVT_MQTT_CONNECTED,          /**< MQTT broker CONNACK received */
    SM_EVT_MQTT_DISCONNECTED,       /**< MQTT connection lost */
    SM_EVT_OTA_NOTIFY,              /**< Received OTA notification on MQTT */
    SM_EVT_OTA_POLL,                /**< Periodic OTA poll fired */
    SM_EVT_OTA_COMPLETE,            /**< OTA flash succeeded — reboot pending */
    SM_EVT_OTA_FAILED,              /**< OTA flash error */
    SM_EVT_FACTORY_RESET,           /**< GPIO button held ≥ 5s */
    SM_EVT_ERROR,                   /**< Unrecoverable error */
    SM_EVT_MAX
} sm_event_t;

/* -----------------------------------------------------------------------
 * Public API
 * --------------------------------------------------------------------- */

/**
 * @brief Start the state machine FreeRTOS task.
 *
 * Must be called once from app_main() after NVS is initialised.
 */
void sm_start(void);

/**
 * @brief Send an event to the state machine (thread-safe).
 *
 * Can be called from any task or ISR context.
 *
 * @param event  The event to enqueue.
 */
void sm_send_event(sm_event_t event);

/**
 * @brief Get the current state (for diagnostics / logging only).
 */
sm_state_t sm_get_state(void);

/**
 * @brief Look up the transition table directly (for unit testing).
 *
 * Returns STATE_MAX if state/event are out of range or no transition is
 * defined (i.e. the slot holds the STATE_MAX sentinel).
 *
 * @param state  Source state.
 * @param event  Event to look up.
 * @return       Next state, or STATE_MAX if no transition defined.
 */
sm_state_t sm_get_transition(sm_state_t state, sm_event_t event);

#ifdef __cplusplus
}
#endif
