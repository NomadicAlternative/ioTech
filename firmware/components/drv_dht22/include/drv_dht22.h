/**
 * @file drv_dht22.h
 * @brief DHT22/DHT11 temperature + humidity sensor driver.
 */
#pragma once

#include "io_driver_types.h"

#ifdef __cplusplus
extern "C" {
#endif

/** Driver vtable instance — link into firmware to register. */
extern const driver_t drv_dht22;

#ifdef __cplusplus
}
#endif
