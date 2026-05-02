#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "esp_https_ota.h"
#include "esp_ota_ops.h"
#include "esp_http_client.h"
#include "cJSON.h"

#include "ota_manager.h"
#include "nvs_storage.h"
#include "sm_events.h"

static const char *TAG = "ota_manager";

/* CA cert for HTTPS OTA downloads */
extern const char isrg_root_x1_pem_start[] asm("_binary_isrg_root_x1_pem_start");
extern const char isrg_root_x1_pem_end[]   asm("_binary_isrg_root_x1_pem_end");

#define OTA_POLL_INTERVAL_MS  (60 * 60 * 1000)  /* 1 hour default */

static char s_ota_url[256] = {0};
static uint32_t s_poll_interval_ms = OTA_POLL_INTERVAL_MS;

/* -----------------------------------------------------------------------
 * Semantic version comparison (pure logic — testable on native)
 * Format: MAJOR.MINOR.PATCH
 * --------------------------------------------------------------------- */
int ota_semver_compare(const char *current, const char *latest)
{
    if (!current || !latest) return 0;

    int cur_maj = 0, cur_min = 0, cur_pat = 0;
    int lat_maj = 0, lat_min = 0, lat_pat = 0;

    sscanf(current, "%d.%d.%d", &cur_maj, &cur_min, &cur_pat);
    sscanf(latest,  "%d.%d.%d", &lat_maj, &lat_min, &lat_pat);

    if (lat_maj != cur_maj) return (lat_maj > cur_maj) ? 1 : -1;
    if (lat_min != cur_min) return (lat_min > cur_min) ? 1 : -1;
    if (lat_pat != cur_pat) return (lat_pat > cur_pat) ? 1 : -1;
    return 0;
}

/* -----------------------------------------------------------------------
 * OTA download and flash
 * --------------------------------------------------------------------- */
void ota_manager_set_url(const char *url)
{
    if (url) {
        strlcpy(s_ota_url, url, sizeof(s_ota_url));
    }
}

void ota_manager_begin(void)
{
    if (strlen(s_ota_url) == 0) {
        ESP_LOGE(TAG, "OTA URL not set");
        sm_send_event(SM_EVT_OTA_FAILED);
        return;
    }

    ESP_LOGI(TAG, "Starting OTA from: %s", s_ota_url);

    esp_http_client_config_t http_cfg = {
        .url         = s_ota_url,
        .cert_pem    = isrg_root_x1_pem_start,
        .timeout_ms  = 30000,
    };

    esp_https_ota_config_t ota_cfg = {
        .http_config = &http_cfg,
    };

    esp_err_t err = esp_https_ota(&ota_cfg);
    if (err == ESP_OK) {
        ESP_LOGI(TAG, "OTA successful — rebooting");
        sm_send_event(SM_EVT_OTA_COMPLETE);
        vTaskDelay(pdMS_TO_TICKS(500));
        esp_restart();
    } else {
        ESP_LOGE(TAG, "OTA failed: %s", esp_err_to_name(err));
        sm_send_event(SM_EVT_OTA_FAILED);
    }
}

/* -----------------------------------------------------------------------
 * Periodic OTA poll task
 * --------------------------------------------------------------------- */
static void ota_poll_task(void *arg)
{
    for (;;) {
        vTaskDelay(pdMS_TO_TICKS(s_poll_interval_ms));

        ESP_LOGI(TAG, "OTA periodic poll triggered");

        device_config_t cfg = {0};
        if (nvs_load_device_config(&cfg) != ESP_OK) {
            ESP_LOGW(TAG, "Cannot load device config for OTA poll");
            continue;
        }

        /* Build check URL: {backend_url}/api/firmware?current={fw_version} */
        char check_url[256];
        snprintf(check_url, sizeof(check_url),
                 "%s/api/firmware?current=%s",
                 cfg.backend_url, cfg.firmware_version);

        esp_http_client_config_t http_cfg = {
            .url        = check_url,
            .cert_pem   = isrg_root_x1_pem_start,
            .timeout_ms = 10000,
        };

        char response[256] = {0};
        esp_http_client_handle_t client = esp_http_client_init(&http_cfg);
        if (!client) continue;

        if (esp_http_client_perform(client) == ESP_OK) {
            int status = esp_http_client_get_status_code(client);
            if (status == 200) {
                esp_http_client_read_response(client, response, sizeof(response) - 1);

                /* W3 FIX: parse JSON response {"version":"x.y.z","url":"https://..."}
                 * and compare versions before triggering OTA */
                cJSON *json = cJSON_Parse(response);
                if (json) {
                    cJSON *ver_item = cJSON_GetObjectItemCaseSensitive(json, "version");
                    cJSON *url_item = cJSON_GetObjectItemCaseSensitive(json, "url");

                    if (cJSON_IsString(ver_item) && cJSON_IsString(url_item)) {
                        if (ota_semver_compare(cfg.firmware_version,
                                               ver_item->valuestring) > 0) {
                            ESP_LOGI(TAG, "Newer firmware available: %s (current: %s)",
                                     ver_item->valuestring, cfg.firmware_version);
                            ota_manager_set_url(url_item->valuestring);
                            sm_send_event(SM_EVT_OTA_POLL);
                        } else {
                            ESP_LOGI(TAG, "Firmware up to date: %s",
                                     cfg.firmware_version);
                        }
                    } else {
                        ESP_LOGW(TAG, "OTA poll response missing 'version' or 'url'");
                    }
                    cJSON_Delete(json);
                } else {
                    ESP_LOGW(TAG, "Failed to parse OTA poll response");
                }
            }
        }
        esp_http_client_cleanup(client);
    }
}

void ota_manager_start_poll(void)
{
    static bool started = false;
    if (started) {
        ESP_LOGW(TAG, "OTA poll already running — skipping duplicate start");
        return;
    }
    xTaskCreate(ota_poll_task, "ota_poll", 4096, NULL, 3, NULL);
    ESP_LOGI(TAG, "OTA poll task started (interval: %lums)",
             (unsigned long)s_poll_interval_ms);
    started = true;
}
