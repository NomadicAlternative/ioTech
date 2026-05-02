/**
 * @file sm_events.h
 * @brief State machine event types and send function.
 *
 * Extracted from state_machine.h to break circular dependencies.
 * All components that need to post events include this header instead
 * of state_machine.h.
 */
#pragma once

#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    SM_EVT_NVS_CREDS_FOUND = 0,
    SM_EVT_NVS_CREDS_MISSING,
    SM_EVT_PORTAL_FORM_OK,
    SM_EVT_WIFI_CONNECTED,
    SM_EVT_WIFI_FAILED,
    SM_EVT_PROV_SUCCESS,
    SM_EVT_PROV_CONFLICT,
    SM_EVT_PROV_INVALID,
    SM_EVT_PROV_FAILED,
    SM_EVT_MQTT_CONNECTED,
    SM_EVT_MQTT_DISCONNECTED,
    SM_EVT_OTA_NOTIFY,
    SM_EVT_OTA_POLL,
    SM_EVT_OTA_COMPLETE,
    SM_EVT_OTA_FAILED,
    SM_EVT_FACTORY_RESET,
    SM_EVT_ERROR,
    SM_EVT_MAX
} sm_event_t;

/**
 * @brief Send an event to the state machine (thread-safe).
 * Can be called from any task or ISR context.
 */
void sm_send_event(sm_event_t event);

#ifdef __cplusplus
}
#endif
