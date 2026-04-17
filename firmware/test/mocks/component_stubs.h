/**
 * @file component_stubs.h
 * @brief Stub implementations for all ioTech component APIs used by
 *        state_machine.c.  Include this in native unit tests BEFORE
 *        including state_machine.c so that all function calls resolve
 *        within the same translation unit.
 *
 * All stubs are declared static inline so they can be included in
 * multiple test files without ODR violations.
 */
#pragma once

#include <string.h>
#include "esp_idf_mock.h"  /* provides esp_err_t, FreeRTOS types, etc. */

/* -----------------------------------------------------------------------
 * nvs_storage stubs
 * --------------------------------------------------------------------- */
#include "../../components/nvs_storage/include/nvs_storage.h"

static inline esp_err_t nvs_store_credentials(const wifi_creds_t *c)
    { (void)c; return ESP_OK; }
static inline esp_err_t nvs_load_credentials(wifi_creds_t *out)
    { (void)out; return ESP_ERR_NVS_NOT_FOUND; }
static inline esp_err_t nvs_store_device_config(const device_config_t *c)
    { (void)c; return ESP_OK; }
static inline esp_err_t nvs_load_device_config(device_config_t *out)
    { (void)out; return ESP_ERR_NVS_NOT_FOUND; }
static inline esp_err_t nvs_storage_erase_all(void) { return ESP_OK; }

/* -----------------------------------------------------------------------
 * wifi_manager stubs
 * --------------------------------------------------------------------- */
#include "../../components/wifi_manager/include/wifi_manager.h"

static inline void wifi_manager_connect(const wifi_creds_t *c) { (void)c; }
static inline void wifi_manager_disconnect(void) {}
static inline void wifi_manager_get_ip(char *b, size_t l)
    { if (b && l > 0) b[0] = '\0'; }

/* -----------------------------------------------------------------------
 * captive_portal stubs
 * --------------------------------------------------------------------- */
#include "../../components/captive_portal/include/captive_portal.h"

static inline void captive_portal_start(void) {}
static inline void captive_portal_stop(void)  {}

/* -----------------------------------------------------------------------
 * provisioning_client stubs
 * --------------------------------------------------------------------- */
#include "../../components/provisioning_client/include/provisioning_client.h"

static inline prov_result_t provisioning_client_register(device_config_t *c)
    { (void)c; return PROV_RESULT_ERROR; }
static inline esp_err_t provisioning_build_topic(const device_config_t *c,
    const char *sub, char *out, size_t len)
    { (void)c; (void)sub; if (out && len > 0) out[0] = '\0'; return ESP_OK; }

/* -----------------------------------------------------------------------
 * mqtt_manager stubs
 * --------------------------------------------------------------------- */
#include "../../components/mqtt_manager/include/mqtt_manager.h"

static inline void mqtt_manager_start(const device_config_t *c) { (void)c; }
static inline void mqtt_manager_stop(void) {}
static inline esp_err_t mqtt_publish_telemetry(const char *p) { (void)p; return ESP_OK; }
static inline esp_err_t mqtt_publish_status(const char *s) { (void)s; return ESP_OK; }
typedef void (*mqtt_ota_cb_t_stub)(const char *);
static inline void mqtt_subscribe_ota_notify(mqtt_ota_cb_t cb) { (void)cb; }

/* -----------------------------------------------------------------------
 * ota_manager stubs
 * --------------------------------------------------------------------- */
#include "../../components/ota_manager/include/ota_manager.h"

static inline void ota_manager_start_poll(void) {}
static inline void ota_manager_begin(void) {}
static inline void ota_manager_set_url(const char *u) { (void)u; }
static inline int  ota_semver_compare(const char *c, const char *l)
    { (void)c; (void)l; return 0; }

/* -----------------------------------------------------------------------
 * factory_reset stubs
 * --------------------------------------------------------------------- */
#include "../../components/factory_reset/include/factory_reset.h"

static inline void  factory_reset_monitor_start(void) {}
static inline bool  factory_reset_should_trigger(uint32_t p, uint32_t t)
    { return p >= t; }
