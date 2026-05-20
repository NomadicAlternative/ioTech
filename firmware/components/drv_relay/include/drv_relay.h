/**
 * @file drv_relay.h
 * @brief RELAY actuator driver (1-8 channels, active-LOW).
 */
#pragma once

#include "io_driver_types.h"

#ifdef __cplusplus
extern "C" {
#endif

/** Driver vtable instance — link into firmware to register. */
extern const driver_t drv_relay;

#ifdef __cplusplus
}
#endif
