/**
 * @file io_driver.h
 * @brief io_driver engine — public API for main.c, state_machine, mqtt_manager.
 */
#pragma once

#include "io_driver_types.h"

/* Forward-declare cJSON to avoid pulling in cJSON.h in all consumers */
struct cJSON;

#ifdef __cplusplus
extern "C" {
#endif

/* ── Lifecycle ─────────────────────────────────────────────────────── */

/**
 * Initialize the engine: zero the registry and active list.
 * On ESP32 targets: iterates linker-set .io_drivers section to auto-register
 * all linked drivers. On fallback builds, drivers must be manually registered
 * after this call.
 */
void io_driver_init(void);

/**
 * Register a driver implementation. Called automatically via linker-set
 * iteration, or manually in main.c for the fallback path.
 *
 * @return DRV_OK, DRV_ERR_STATE (duplicate name), DRV_ERR_ARG (NULL).
 */
drv_err_t io_driver_register(const driver_t *driver);

/**
 * Load and initialize a driver by name with resolved configuration.
 * Looks up registry, calls driver->init(), appends to active list.
 *
 * @return DRV_OK, DRV_ERR_NOT_FOUND, or error from driver->init().
 */
drv_err_t io_driver_load(const char *name, const driver_config_t *cfg);

/**
 * Load all drivers from NVS-stored configuration.
 * Reads the "drv_count" / "drv_N" keys and calls io_driver_load() for each.
 * Must be called after NVS is initialized.
 *
 * @return DRV_OK (even if NVS has no driver config — that's valid).
 */
drv_err_t io_driver_load_all_from_nvs(void);

/**
 * Load default drivers when NVS has no config (first boot after flash).
 * Activates DHT22, RELAY, and other board-expected drivers.
 * Must be called after io_driver_init() and board pinmap init.
 *
 * @return DRV_OK.
 */
drv_err_t io_driver_load_all_defaults(void);

/* ── Runtime ───────────────────────────────────────────────────────── */

/**
 * Collect telemetry from all active drivers.
 * Returns a cJSON object suitable for mqtt_publish_telemetry().
 * Caller is responsible for cJSON_Delete() on the returned object.
 *
 * Drivers that return errors are silently skipped.
 *
 * @return cJSON* (never NULL — returns empty object {} if no drivers active).
 */
struct cJSON *io_driver_collect_all(void);

/**
 * Dispatch a command to the active driver whose name matches `action_name`.
 *
 * @param action_name  Matched against driver_t.name (case-insensitive).
 * @param arg          Driver-specific argument (cJSON* for structured parsing).
 * @return DRV_OK, DRV_ERR_NOT_FOUND, DRV_ERR_NOT_SUPP, or driver error.
 */
drv_err_t io_driver_dispatch_command(const char *action_name, const void *arg);

/* ── Shutdown ──────────────────────────────────────────────────────── */

/**
 * De-initialize all active drivers in reverse load order.
 * Must be called before OTA firmware update.
 */
void io_driver_deinit_all(void);

/**
 * Get count of active drivers (for logging/debug).
 */
uint8_t io_driver_active_count(void);

#ifdef __cplusplus
}
#endif
