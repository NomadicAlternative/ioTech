/**
 * ESP-IDF mock headers for native (host) unit testing.
 * These stubs allow Unity tests to compile without the ESP-IDF toolchain.
 */
#pragma once

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>

/* -----------------------------------------------------------------------
 * esp_err.h
 * --------------------------------------------------------------------- */
typedef int esp_err_t;
#define ESP_OK          (0)
#define ESP_FAIL        (-1)
#define ESP_ERR_INVALID_ARG    0x102
#define ESP_ERR_INVALID_SIZE   0x103
#define ESP_ERR_NVS_NOT_FOUND  0x1100
#define ESP_ERR_NVS_NO_FREE_PAGES  0x1101
#define ESP_ERR_NVS_NEW_VERSION_FOUND 0x1102
#define ESP_ERR_NOT_FOUND    0x104
#define ESP_ERR_TIMEOUT      0x107
#define ESP_ERR_NO_MEM       0x101

static inline const char *esp_err_to_name(esp_err_t code) {
    (void)code; return "MOCK_ERR";
}

/* -----------------------------------------------------------------------
 * Logging stubs
 * --------------------------------------------------------------------- */
#define ESP_LOGI(tag, fmt, ...) printf("[I][%s] " fmt "\n", tag, ##__VA_ARGS__)
#define ESP_LOGW(tag, fmt, ...) printf("[W][%s] " fmt "\n", tag, ##__VA_ARGS__)
#define ESP_LOGE(tag, fmt, ...) printf("[E][%s] " fmt "\n", tag, ##__VA_ARGS__)
#define ESP_LOGD(tag, fmt, ...) do {} while(0)
#define ESP_ERROR_CHECK(x)      do { esp_err_t _r = (x); (void)_r; } while(0)

/* -----------------------------------------------------------------------
 * NVS stubs (simple in-memory key-value store for tests)
 * --------------------------------------------------------------------- */
typedef int nvs_handle_t;
#define NVS_READWRITE 1
#define NVS_READONLY  0

static inline esp_err_t nvs_flash_init(void) { return ESP_OK; }
static inline esp_err_t nvs_flash_erase(void) { return ESP_OK; }
static inline esp_err_t nvs_open(const char *ns, int mode, nvs_handle_t *h) {
    (void)ns; (void)mode; *h = 1; return ESP_OK;
}
static inline void nvs_close(nvs_handle_t h) { (void)h; }
static inline esp_err_t nvs_commit(nvs_handle_t h) { (void)h; return ESP_OK; }

/* In-memory NVS simulation (up to 16 key-value pairs) */
#define MOCK_NVS_MAX_ENTRIES 16
typedef struct { char key[32]; char val[256]; } mock_nvs_entry_t;
static mock_nvs_entry_t mock_nvs_store[MOCK_NVS_MAX_ENTRIES];
static int mock_nvs_count = 0;

static inline void mock_nvs_reset(void) { mock_nvs_count = 0; }

static inline esp_err_t nvs_set_str(nvs_handle_t h, const char *key, const char *val) {
    (void)h;
    for (int i = 0; i < mock_nvs_count; i++) {
        if (strcmp(mock_nvs_store[i].key, key) == 0) {
            strncpy(mock_nvs_store[i].val, val, 255);
            return ESP_OK;
        }
    }
    if (mock_nvs_count < MOCK_NVS_MAX_ENTRIES) {
        strncpy(mock_nvs_store[mock_nvs_count].key, key, 31);
        strncpy(mock_nvs_store[mock_nvs_count].val, val, 255);
        mock_nvs_count++;
        return ESP_OK;
    }
    return ESP_FAIL;
}

static inline esp_err_t nvs_get_str(nvs_handle_t h, const char *key, char *out, size_t *len) {
    (void)h;
    for (int i = 0; i < mock_nvs_count; i++) {
        if (strcmp(mock_nvs_store[i].key, key) == 0) {
            strncpy(out, mock_nvs_store[i].val, *len - 1);
            out[*len - 1] = '\0';
            *len = strlen(out) + 1;
            return ESP_OK;
        }
    }
    return ESP_ERR_NVS_NOT_FOUND;
}

static inline esp_err_t nvs_erase_all(nvs_handle_t h) {
    (void)h; mock_nvs_count = 0; return ESP_OK;
}

/* -----------------------------------------------------------------------
 * FreeRTOS stubs
 * --------------------------------------------------------------------- */
typedef void*    QueueHandle_t;
typedef void*    TaskHandle_t;
typedef int      BaseType_t;
#define pdTRUE  1
#define pdFALSE 0
#define pdMS_TO_TICKS(ms) ((uint32_t)(ms))
#define portMAX_DELAY 0xFFFFFFFF
#define configASSERT(x) do {} while(0)

static inline QueueHandle_t xQueueCreate(int len, int item_size) {
    (void)len; (void)item_size; return NULL;
}
static inline int xQueueSend(QueueHandle_t q, void *item, uint32_t ticks) {
    (void)q; (void)item; (void)ticks; return pdTRUE;
}
static inline int xQueueReceive(QueueHandle_t q, void *item, uint32_t ticks) {
    (void)q; (void)item; (void)ticks; return pdFALSE;
}
static inline int xQueueSendFromISR(QueueHandle_t q, void *item, BaseType_t *b) {
    (void)q; (void)item; (void)b; return pdTRUE;
}
#define portYIELD_FROM_ISR(x) do {} while(0)
static inline int xTaskCreate(void (*fn)(void *), const char *name, int stack,
                               void *arg, int prio, TaskHandle_t *h) {
    (void)fn; (void)name; (void)stack; (void)arg; (void)prio; (void)h; return pdTRUE;
}
static inline void vTaskDelete(TaskHandle_t t) { (void)t; }
static inline void vTaskDelay(uint32_t ticks) { (void)ticks; }
static inline void esp_restart(void) {}
static inline int xPortInIsrContext(void) { return 0; }

/* -----------------------------------------------------------------------
 * GPIO stubs (driver/gpio.h)
 * --------------------------------------------------------------------- */
typedef struct {
    uint64_t pin_bit_mask;
    int      mode;
    int      pull_up_en;
    int      pull_down_en;
    int      intr_type;
} gpio_config_t;
#define GPIO_MODE_INPUT       1
#define GPIO_PULLUP_ENABLE    1
#define GPIO_PULLDOWN_DISABLE 0
#define GPIO_INTR_DISABLE     0

static int mock_gpio_level = 1;  /* default: released (HIGH) */
static inline esp_err_t gpio_config(const gpio_config_t *c) { (void)c; return ESP_OK; }
static inline int gpio_get_level(int pin) { (void)pin; return mock_gpio_level; }

/* -----------------------------------------------------------------------
 * HTTP client stubs (esp_http_client.h)
 * --------------------------------------------------------------------- */
typedef void *esp_http_client_handle_t;
typedef struct {
    const char *url;
    int         method;
    const char *cert_pem;
    int         timeout_ms;
    int         transport_type;
} esp_http_client_config_t;

#define HTTP_METHOD_GET       0
#define HTTP_METHOD_POST      1
#define HTTP_TRANSPORT_OVER_SSL 2

static inline esp_http_client_handle_t esp_http_client_init(
    const esp_http_client_config_t *c) { (void)c; return NULL; }
static inline esp_err_t esp_http_client_perform(esp_http_client_handle_t c) {
    (void)c; return ESP_FAIL;
}
static inline int esp_http_client_get_status_code(esp_http_client_handle_t c) {
    (void)c; return 0;
}
static inline int esp_http_client_get_content_length(esp_http_client_handle_t c) {
    (void)c; return 0;
}
static inline esp_err_t esp_http_client_read_response(esp_http_client_handle_t c,
                                                       char *buf, int len) {
    (void)c; (void)buf; (void)len; return ESP_FAIL;
}
static inline esp_err_t esp_http_client_cleanup(esp_http_client_handle_t c) {
    (void)c; return ESP_OK;
}
static inline esp_err_t esp_http_client_set_header(esp_http_client_handle_t c,
                                                    const char *k, const char *v) {
    (void)c; (void)k; (void)v; return ESP_OK;
}
static inline esp_err_t esp_http_client_set_post_field(esp_http_client_handle_t c,
                                                        const char *d, int l) {
    (void)c; (void)d; (void)l; return ESP_OK;
}

/* -----------------------------------------------------------------------
 * TLS stub (esp_tls.h)
 * --------------------------------------------------------------------- */
/* Nothing needed — types used by http_client are already stubbed */

/* -----------------------------------------------------------------------
 * cJSON stubs (cJSON.h)
 * --------------------------------------------------------------------- */
typedef struct cJSON {
    char *valuestring;
    int   valueint;
    double valuedouble;
    int   type;
} cJSON;
#define cJSON_String 4
static inline cJSON *cJSON_Parse(const char *s) { (void)s; return NULL; }
static inline cJSON *cJSON_GetObjectItemCaseSensitive(const cJSON *obj, const char *k) {
    (void)obj; (void)k; return NULL;
}
static inline int cJSON_IsString(const cJSON *item) {
    return (item != NULL && item->valuestring != NULL);
}
static inline void cJSON_Delete(cJSON *item) { (void)item; }
static inline cJSON *cJSON_CreateObject(void) { static cJSON obj = {0}; return &obj; }
static inline cJSON *cJSON_AddNumberToObject(cJSON *obj, const char *key, double v) { (void)obj; (void)key; (void)v; return (cJSON*)1; }
static inline cJSON *cJSON_AddStringToObject(cJSON *obj, const char *key, const char *v) { (void)obj; (void)key; (void)v; return (cJSON*)1; }
static inline cJSON *cJSON_AddBoolToObject(cJSON *obj, const char *key, int v) { (void)obj; (void)key; (void)v; return (cJSON*)1; }
static inline char *cJSON_PrintUnformatted(const cJSON *obj) { (void)obj; return (char*)"{}"; }

/* -----------------------------------------------------------------------
 * OTA / esp_ota_ops stubs
 * --------------------------------------------------------------------- */
static inline esp_err_t esp_ota_mark_app_valid_cancel_rollback(void) { return ESP_OK; }
/* C3 FIX: match the real struct layout used in ota_manager.c */
typedef struct { const void *http_config; } esp_https_ota_config_t;
static inline esp_err_t esp_https_ota(const esp_https_ota_config_t *cfg) { (void)cfg; return ESP_FAIL; }

/* -----------------------------------------------------------------------
 * WiFi stubs (esp_wifi.h)
 * --------------------------------------------------------------------- */
static inline esp_err_t esp_wifi_stop(void) { return ESP_OK; }

/* -----------------------------------------------------------------------
 * eFuse/MAC stub
 * --------------------------------------------------------------------- */
static inline esp_err_t esp_efuse_mac_get_default(uint8_t *mac) {
    uint8_t fake[] = {0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF};
    memcpy(mac, fake, 6);
    return ESP_OK;
}

/* -----------------------------------------------------------------------
 * State machine stub (tests can capture sent events)
 * --------------------------------------------------------------------- */
#ifndef STATE_MACHINE_H  /* guard to avoid double-include when testing sm */
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
static sm_event_t last_sm_event = SM_EVT_MAX;
static inline void sm_send_event(sm_event_t e) { last_sm_event = e; }
#endif
