/**
 * @file io_driver.c
 * @brief io_driver engine — registry, load, collect, dispatch, deinit.
 */
#include "io_driver.h"
#include "io_driver_types.h"

#include <string.h>
#include <strings.h>
#include "cJSON.h"
#include "esp_err.h"
#include "esp_log.h"

static const char *TAG = "io_driver";

/* ── Internal state ───────────────────────────────────────────────── */

static const driver_t *s_registry[IO_DRIVER_MAX_REGISTRY];
static uint8_t           s_registry_count = 0;

static const driver_t *s_active[IO_DRIVER_MAX_ACTIVE];
static uint8_t         s_active_count = 0;

/* ── Conversion helpers ───────────────────────────────────────────── */

static inline esp_err_t drv_to_esp(drv_err_t e) {
    switch (e) {
    case DRV_OK:             return ESP_OK;
    case DRV_ERR_ARG:        return ESP_ERR_INVALID_ARG;
    case DRV_ERR_NOT_FOUND:  return ESP_ERR_NOT_FOUND;
    case DRV_ERR_TIMEOUT:    return ESP_ERR_TIMEOUT;
    default:                 return ESP_FAIL;
    }
}

static inline drv_err_t esp_to_drv(esp_err_t e) {
    if (e == ESP_OK)                 return DRV_OK;
    if (e == ESP_ERR_INVALID_ARG)    return DRV_ERR_ARG;
    if (e == ESP_ERR_NOT_FOUND)      return DRV_ERR_NOT_FOUND;
    if (e == ESP_ERR_TIMEOUT)        return DRV_ERR_TIMEOUT;
    return DRV_ERR_INTERNAL;
}

/* ── Lifecycle ─────────────────────────────────────────────────────── */

void io_driver_init(void)
{
    memset(s_registry, 0, sizeof(s_registry));
    s_registry_count = 0;
    memset(s_active, 0, sizeof(s_active));
    s_active_count = 0;

#ifndef IO_DRIVER_MANUAL_REGISTRY
    /* Linker-set auto-discovery */
    extern const driver_t *__start_io_drivers;
    extern const driver_t *__stop_io_drivers;

    const driver_t **p = &__start_io_drivers;
    while (p < &__stop_io_drivers) {
        io_driver_register(*p);
        p++;
    }
#endif

    ESP_LOGI(TAG, "Initialized: %u drivers registered", s_registry_count);
}

drv_err_t io_driver_register(const driver_t *driver)
{
    if (driver == NULL) {
        return DRV_ERR_ARG;
    }

    if (s_registry_count >= IO_DRIVER_MAX_REGISTRY) {
        ESP_LOGE(TAG, "Registry full (max %d)", IO_DRIVER_MAX_REGISTRY);
        return DRV_ERR_STATE;
    }

    /* Check for duplicate name (case-sensitive) */
    for (uint8_t i = 0; i < s_registry_count; i++) {
        if (s_registry[i]->name && driver->name &&
            strcmp(s_registry[i]->name, driver->name) == 0) {
            ESP_LOGW(TAG, "Driver '%s' already registered", driver->name);
            return DRV_ERR_STATE;
        }
    }

    s_registry[s_registry_count++] = driver;
    ESP_LOGI(TAG, "Registered driver: %s", driver->name ? driver->name : "(null)");
    return DRV_OK;
}

drv_err_t io_driver_load(const char *name, const driver_config_t *cfg)
{
    if (name == NULL || cfg == NULL) {
        return DRV_ERR_ARG;
    }

    if (s_active_count >= IO_DRIVER_MAX_ACTIVE) {
        ESP_LOGE(TAG, "Active list full (max %d)", IO_DRIVER_MAX_ACTIVE);
        return DRV_ERR_STATE;
    }

    /* Case-insensitive lookup */
    for (uint8_t i = 0; i < s_registry_count; i++) {
        const driver_t *drv = s_registry[i];
        if (drv->name && strcasecmp(drv->name, name) == 0) {
            if (drv->init == NULL) {
                ESP_LOGE(TAG, "Driver '%s' has NULL init", drv->name);
                return DRV_ERR_INTERNAL;
            }
            drv_err_t err = drv->init(cfg);
            if (err == DRV_OK) {
                s_active[s_active_count++] = drv;
                ESP_LOGI(TAG, "Loaded driver: %s (active count: %u)",
                         drv->name, s_active_count);
            } else {
                ESP_LOGW(TAG, "Driver '%s' init failed: %s",
                         drv->name, drv_err_str(err));
            }
            return err;
        }
    }

    ESP_LOGW(TAG, "Driver '%s' not found in registry", name);
    return DRV_ERR_NOT_FOUND;
}

/* ── Runtime ───────────────────────────────────────────────────────── */

struct cJSON *io_driver_collect_all(void)
{
    cJSON *root = cJSON_CreateObject();
    if (root == NULL) {
        return cJSON_CreateObject(); /* best-effort empty object */
    }

    for (uint8_t i = 0; i < s_active_count; i++) {
        if (s_active[i]->read == NULL) continue;

        driver_value_t values[DRV_MAX_VALUES];
        uint8_t count = 0;
        drv_err_t err = s_active[i]->read(values, &count);

        if (err != DRV_OK) {
            ESP_LOGW(TAG, "Driver '%s' read failed: %s (skipping)",
                     s_active[i]->name ? s_active[i]->name : "?", drv_err_str(err));
            continue;
        }

        for (uint8_t v = 0; v < count && v < DRV_MAX_VALUES; v++) {
            switch (values[v].type) {
            case DRV_VAL_NUMBER:
                cJSON_AddNumberToObject(root, values[v].key, values[v].number_value);
                break;
            case DRV_VAL_STRING:
                cJSON_AddStringToObject(root, values[v].key, values[v].string_value);
                break;
            case DRV_VAL_BOOL:
                cJSON_AddBoolToObject(root, values[v].key, values[v].bool_value ? 1 : 0);
                break;
            default:
                break;
            }
        }
    }

    return root;
}

drv_err_t io_driver_dispatch_command(const char *action_name, const void *arg)
{
    if (action_name == NULL) {
        return DRV_ERR_ARG;
    }

    /* Case-insensitive match against active driver names */
    for (uint8_t i = 0; i < s_active_count; i++) {
        if (s_active[i]->name && strcasecmp(s_active[i]->name, action_name) == 0) {
            if (s_active[i]->command == NULL) {
                return DRV_ERR_NOT_SUPP;
            }
            return s_active[i]->command(action_name, arg);
        }
    }

    ESP_LOGW(TAG, "No active driver matches action '%s'", action_name);
    return DRV_ERR_NOT_FOUND;
}

/* ── Shutdown ──────────────────────────────────────────────────────── */

void io_driver_deinit_all(void)
{
    /* Reverse load order */
    for (int i = (int)s_active_count - 1; i >= 0; i--) {
        if (s_active[i]->deinit) {
            drv_err_t err = s_active[i]->deinit();
            if (err != DRV_OK) {
                ESP_LOGW(TAG, "Driver '%s' deinit returned %s",
                         s_active[i]->name ? s_active[i]->name : "?", drv_err_str(err));
            }
        }
    }
    memset(s_active, 0, sizeof(s_active));
    s_active_count = 0;
    ESP_LOGI(TAG, "All drivers deinitialized");
}

uint8_t io_driver_active_count(void)
{
    return s_active_count;
}
