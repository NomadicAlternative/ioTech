/**
 * @file state_machine.h
 * @brief Central finite-state machine for the ioTech ESP32 firmware.
 *
 * Defines all device states, events, and the public API used to start
 * the state machine task and post events from any task or ISR context.
 */
#pragma once

#include <stdint.h>
#include "esp_err.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "sm_events.h"

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
 * Public API
 * --------------------------------------------------------------------- */

/**
 * @brief Start the state machine FreeRTOS task.
 */
void sm_start(void);

/**
 * @brief Get the current state (for diagnostics / logging only).
 */
sm_state_t sm_get_state(void);

/**
 * @brief Look up the transition table directly (for unit testing).
 */
sm_state_t sm_get_transition(sm_state_t state, sm_event_t event);

#ifdef __cplusplus
}
#endif
