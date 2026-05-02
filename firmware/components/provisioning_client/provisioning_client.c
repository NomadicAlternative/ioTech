#include <string.h>
#include <stdio.h>
#include "esp_log.h"
#include "esp_http_client.h"
#include "esp_tls.h"
#include "cJSON.h"
#include "esp_mac.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "provisioning_client.h"
#include "nvs_storage.h"
#include "sm_events.h"

static const char *TAG = "provisioning_client";

/* CA cert for TLS verification */
extern const char isrg_root_x1_pem_start[] asm("_binary_isrg_root_x1_pem_start");
extern const char isrg_root_x1_pem_end[]   asm("_binary_isrg_root_x1_pem_end");

#define PROV_ENDPOINT  "/api/provisioning"
#define MAX_BODY_LEN   512
#define RETRY_COUNT    3
#define RETRY_DELAY_MS 5000

/* -----------------------------------------------------------------------
 * Topic builder (pure logic — easily testable on native)
 * --------------------------------------------------------------------- */
esp_err_t provisioning_build_topic(const device_config_t *cfg,
                                   const char *subtopic,
                                   char *out, size_t out_len)
{
    if (!cfg || !subtopic || !out) return ESP_ERR_INVALID_ARG;

    int written = snprintf(out, out_len, "org/%s/device/%s/%s",
                           cfg->tenant_id, cfg->device_id, subtopic);
    if (written < 0 || (size_t)written >= out_len) {
        return ESP_ERR_INVALID_SIZE;
    }
    return ESP_OK;
}

static char s_response_buf[1024];
static int  s_response_len = 0;

static esp_err_t http_event_handler(esp_http_client_event_t *evt)
{
    switch (evt->event_id) {
    case HTTP_EVENT_ON_DATA:
        if (s_response_len + evt->data_len < (int)sizeof(s_response_buf) - 1) {
            memcpy(s_response_buf + s_response_len, evt->data, evt->data_len);
            s_response_len += evt->data_len;
            s_response_buf[s_response_len] = '\0';
        }
        break;
    case HTTP_EVENT_ON_CONNECTED:
    case HTTP_EVENT_HEADERS_SENT:
    case HTTP_EVENT_ON_HEADER:
    case HTTP_EVENT_ON_FINISH:
    case HTTP_EVENT_DISCONNECTED:
    case HTTP_EVENT_REDIRECT:
        break;
    default:
        break;
    }
    return ESP_OK;
}

/* -----------------------------------------------------------------------
 * Provisioning HTTP client
 * --------------------------------------------------------------------- */
static prov_result_t do_provision_request(device_config_t *cfg)
{
    char url[256];
    snprintf(url, sizeof(url), "%s%s", cfg->backend_url, PROV_ENDPOINT);

    char body[MAX_BODY_LEN];
    snprintf(body, sizeof(body),
             "{\"hardware_id\":\"%s\",\"claim_token\":\"%s\"}",
             cfg->hardware_id, cfg->claim_token);

    char response_buf[1024] = {0};
    int  response_len       = 0;
    int  http_status        = 0;

    /* Reset shared response buffer */
    memset(s_response_buf, 0, sizeof(s_response_buf));
    s_response_len = 0;

    /* Use TLS only for https:// URLs; plain TCP for http:// (dev/local) */
    bool use_tls = (strncmp(url, "https://", 8) == 0);

    esp_http_client_config_t http_cfg = {
        .url            = url,
        .method         = HTTP_METHOD_POST,
        .cert_pem       = use_tls ? isrg_root_x1_pem_start : NULL,
        .timeout_ms     = 10000,
        .transport_type = use_tls ? HTTP_TRANSPORT_OVER_SSL : HTTP_TRANSPORT_OVER_TCP,
        .event_handler  = http_event_handler,
    };

    esp_http_client_handle_t client = esp_http_client_init(&http_cfg);
    if (!client) {
        ESP_LOGE(TAG, "Failed to init HTTP client");
        return PROV_RESULT_ERROR;
    }

    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_post_field(client, body, strlen(body));

    esp_err_t err = esp_http_client_perform(client);
    if (err == ESP_OK) {
        http_status  = esp_http_client_get_status_code(client);
        response_len = s_response_len;
        memcpy(response_buf, s_response_buf, response_len + 1);
    }

    esp_http_client_cleanup(client);

    if (err != ESP_OK) {
        ESP_LOGE(TAG, "HTTP request failed: %s", esp_err_to_name(err));
        return PROV_RESULT_ERROR;
    }

    ESP_LOGI(TAG, "POST %s → HTTP %d", url, http_status);

    switch (http_status) {
    case 200: {
        /* Parse JSON response */
        ESP_LOGI(TAG, "Response body (%d bytes): %s", response_len, response_buf);
        cJSON *json = cJSON_Parse(response_buf);
        if (!json) {
            ESP_LOGE(TAG, "Failed to parse provisioning response");
            return PROV_RESULT_ERROR;
        }

        cJSON *device_token    = cJSON_GetObjectItemCaseSensitive(json, "device_token");
        cJSON *tenant_id       = cJSON_GetObjectItemCaseSensitive(json, "tenant_id");
        cJSON *device_id       = cJSON_GetObjectItemCaseSensitive(json, "device_id");
        cJSON *mqtt_broker_url = cJSON_GetObjectItemCaseSensitive(json, "mqtt_url");

        if (!cJSON_IsString(device_token) || !cJSON_IsString(tenant_id) ||
            !cJSON_IsString(device_id)    || !cJSON_IsString(mqtt_broker_url))
        {
            ESP_LOGE(TAG, "Missing required fields in provisioning response");
            cJSON_Delete(json);
            return PROV_RESULT_ERROR;
        }

        strlcpy(cfg->device_token,    device_token->valuestring,    sizeof(cfg->device_token));
        strlcpy(cfg->tenant_id,       tenant_id->valuestring,       sizeof(cfg->tenant_id));
        strlcpy(cfg->device_id,       device_id->valuestring,       sizeof(cfg->device_id));
        strlcpy(cfg->mqtt_broker_url, mqtt_broker_url->valuestring, sizeof(cfg->mqtt_broker_url));

        /* Clear claim_token — it's single-use */
        memset(cfg->claim_token, 0, sizeof(cfg->claim_token));

        nvs_store_device_config(cfg);
        cJSON_Delete(json);
        return PROV_RESULT_OK;
    }
    case 409:
        ESP_LOGW(TAG, "Device already provisioned (409)");
        return PROV_RESULT_CONFLICT;
    case 422:
        ESP_LOGW(TAG, "Invalid claim token (422) — clearing from NVS");
        memset(cfg->claim_token, 0, sizeof(cfg->claim_token));
        nvs_store_device_config(cfg);
        return PROV_RESULT_INVALID;
    default:
        ESP_LOGE(TAG, "Unexpected HTTP status: %d", http_status);
        return PROV_RESULT_ERROR;
    }
}

prov_result_t provisioning_client_register(device_config_t *cfg)
{
    if (!cfg) return PROV_RESULT_ERROR;

    /* Derive hardware_id from MAC address */
    uint8_t mac[6];
    esp_efuse_mac_get_default(mac);
    snprintf(cfg->hardware_id, sizeof(cfg->hardware_id),
             "%02x%02x%02x%02x%02x%02x",
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);

    for (int attempt = 1; attempt <= RETRY_COUNT; attempt++) {
        prov_result_t result = do_provision_request(cfg);

        if (result != PROV_RESULT_ERROR) {
            return result;
        }

        ESP_LOGW(TAG, "Provisioning attempt %d/%d failed — retrying in %dms",
                 attempt, RETRY_COUNT, RETRY_DELAY_MS);

        if (attempt < RETRY_COUNT) {
            vTaskDelay(pdMS_TO_TICKS(RETRY_DELAY_MS));
        }
    }

    ESP_LOGE(TAG, "Provisioning failed after %d attempts", RETRY_COUNT);
    return PROV_RESULT_ERROR;
}
