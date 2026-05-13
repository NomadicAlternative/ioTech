#include <string.h>
#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/timers.h"
#include "esp_log.h"
#include "mqtt_client.h"
#include "esp_tls.h"

#include "mqtt_manager.h"
#include "ota_manager.h"
#include "nvs_storage.h"
#include "sm_events.h"
#include "relay_controller.h"
#include "cJSON.h"
#include "driver/gpio.h"
#include "esp_timer.h"

static const char *TAG = "mqtt_manager";

/* CA cert for broker TLS */
extern const char isrg_root_x1_pem_start[] asm("_binary_isrg_root_x1_pem_start");
extern const char isrg_root_x1_pem_end[]   asm("_binary_isrg_root_x1_pem_end");

/* -----------------------------------------------------------------------
 * Internal state
 * --------------------------------------------------------------------- */
static esp_mqtt_client_handle_t s_client     = NULL;
static mqtt_ota_cb_t             s_ota_cb    = NULL;
static device_config_t           s_cfg       = {0};
static TaskHandle_t              s_heartbeat_task = NULL;

/* Exponential backoff: 2s → 4s → 8s → ... cap 120s */
static uint32_t s_reconnect_delay_ms = 2000;
#define MQTT_RECONNECT_MAX_MS 120000

/* -----------------------------------------------------------------------
 * DHT11 Sensor Reading
 * --------------------------------------------------------------------- */
#define DHT11_GPIO 14

static float dht11_temp = 0.0f;
static float dht11_hum = 0.0f;

static bool dht11_read(float *temp, float *hum)
{
    uint8_t data[5] = {0};

    gpio_set_direction(DHT11_GPIO, GPIO_MODE_OUTPUT);
    gpio_set_level(DHT11_GPIO, 0);
    esp_rom_delay_us(18000);
    gpio_set_level(DHT11_GPIO, 1);
    esp_rom_delay_us(40);
    gpio_set_pull_mode(DHT11_GPIO, GPIO_PULLUP_ONLY);
    gpio_set_direction(DHT11_GPIO, GPIO_MODE_INPUT);

    int64_t t = esp_timer_get_time();
    while (gpio_get_level(DHT11_GPIO) == 1) { if (esp_timer_get_time() - t > 100) return false; }
    t = esp_timer_get_time();
    while (gpio_get_level(DHT11_GPIO) == 0) { if (esp_timer_get_time() - t > 100) return false; }
    t = esp_timer_get_time();
    while (gpio_get_level(DHT11_GPIO) == 1) { if (esp_timer_get_time() - t > 100) return false; }

    for (int i = 0; i < 40; i++) {
        t = esp_timer_get_time();
        while (gpio_get_level(DHT11_GPIO) == 0) { if (esp_timer_get_time() - t > 80) return false; }
        t = esp_timer_get_time();
        while (gpio_get_level(DHT11_GPIO) == 1) { if (esp_timer_get_time() - t > 80) break; }
        if (esp_timer_get_time() - t > 40) data[i / 8] |= (1 << (7 - (i % 8)));
    }

    if (data[4] != ((data[0] + data[1] + data[2] + data[3]) & 0xFF)) return false;
    *hum = (float)data[0];
    *temp = (float)data[2];
    return true;
}

/* -----------------------------------------------------------------------
 * Heartbeat task: publishes DHT11 telemetry + status every 30s
 * --------------------------------------------------------------------- */
static void heartbeat_task(void *arg)
{
    for (;;) {
        vTaskDelay(pdMS_TO_TICKS(30000));

        // Publish telemetry (DHT11 + timestamp)
        cJSON *root = cJSON_CreateObject();
        int ok = dht11_read(&dht11_temp, &dht11_hum);
        if (ok) {
            cJSON_AddNumberToObject(root, "temperature", dht11_temp);
            cJSON_AddNumberToObject(root, "humidity", dht11_hum);
        } else {
            cJSON_AddStringToObject(root, "dht11", "error");
        }
        cJSON_AddNumberToObject(root, "uptime", esp_timer_get_time() / 1000000);
        char *json = cJSON_PrintUnformatted(root);
        if (json) {
            mqtt_publish_telemetry(json);
            cJSON_free(json);
        }
        cJSON_Delete(root);

        mqtt_publish_status("online");
    }
}

/* -----------------------------------------------------------------------
 * MQTT event handler
 * --------------------------------------------------------------------- */
static void mqtt_event_handler(void *handler_args,
                                esp_event_base_t base,
                                int32_t event_id,
                                void *event_data)
{
    esp_mqtt_event_handle_t event = (esp_mqtt_event_handle_t)event_data;

    switch ((esp_mqtt_event_id_t)event_id) {
    case MQTT_EVENT_CONNECTED:
        ESP_LOGI(TAG, "MQTT connected");
        s_reconnect_delay_ms = 2000;  /* reset backoff on success */

        /* Subscribe to OTA notify topic */
        {
            char topic[256];
            snprintf(topic, sizeof(topic),
                     "org/%s/device/%s/ota/notify",
                     s_cfg.tenant_id, s_cfg.device_id);
            esp_mqtt_client_subscribe(s_client, topic, 1);
        }

        /* Subscribe to config topic for OTA poll interval updates */
        {
            char topic[256];
            snprintf(topic, sizeof(topic),
                     "org/%s/device/%s/config",
                     s_cfg.tenant_id, s_cfg.device_id);
            esp_mqtt_client_subscribe(s_client, topic, 1);
        }

        /* Subscribe to command topic for relay control */
        {
            char topic[256];
            snprintf(topic, sizeof(topic),
                     "org/%s/device/%s/command",
                     s_cfg.tenant_id, s_cfg.device_id);
            esp_mqtt_client_subscribe(s_client, topic, 1);
            ESP_LOGI(TAG, "Subscribed to command topic: %s", topic);
        }

        /* Publish "online" status */
        mqtt_publish_status("online");

        /* Publish test telemetry */
        mqtt_publish_telemetry("{\"uptime\":0}");

        /* Start heartbeat */
        if (!s_heartbeat_task) {
            xTaskCreate(heartbeat_task, "mqtt_heartbeat", 2048, NULL, 3, &s_heartbeat_task);
        }

        sm_send_event(SM_EVT_MQTT_CONNECTED);
        break;

    case MQTT_EVENT_DISCONNECTED:
        ESP_LOGW(TAG, "MQTT disconnected — reconnecting in %lums", (unsigned long)s_reconnect_delay_ms);

        /* Stop heartbeat */
        if (s_heartbeat_task) {
            vTaskDelete(s_heartbeat_task);
            s_heartbeat_task = NULL;
        }

        vTaskDelay(pdMS_TO_TICKS(s_reconnect_delay_ms));
        esp_mqtt_client_reconnect(s_client);

        /* Double backoff, cap at maximum */
        s_reconnect_delay_ms *= 2;
        if (s_reconnect_delay_ms > MQTT_RECONNECT_MAX_MS) {
            s_reconnect_delay_ms = MQTT_RECONNECT_MAX_MS;
        }
        sm_send_event(SM_EVT_MQTT_DISCONNECTED);
        break;

    case MQTT_EVENT_DATA: {
        char topic[256] = {0};
        char data[512]  = {0};

        int topic_len = event->topic_len < (int)sizeof(topic) - 1 ? event->topic_len : (int)sizeof(topic) - 1;
        int data_len  = event->data_len  < (int)sizeof(data)  - 1 ? event->data_len  : (int)sizeof(data)  - 1;

        memcpy(topic, event->topic, topic_len);
        memcpy(data,  event->data,  data_len);

        /* Check if this is an OTA notify message */
        char ota_topic[256];
        snprintf(ota_topic, sizeof(ota_topic),
                 "org/%s/device/%s/ota/notify",
                 s_cfg.tenant_id, s_cfg.device_id);

        if (strncmp(topic, ota_topic, strlen(ota_topic)) == 0) {
            ESP_LOGI(TAG, "OTA notify received: %s", data);

            cJSON *root = cJSON_Parse(data);
            if (root) {
                cJSON *j_version = cJSON_GetObjectItem(root, "version");
                cJSON *j_url     = cJSON_GetObjectItem(root, "url");

                if (cJSON_IsString(j_url)) {
                    ESP_LOGI(TAG, "OTA URL: %s", j_url->valuestring);
                    ota_manager_set_url(j_url->valuestring);

                    if (cJSON_IsString(j_version)) {
                        ESP_LOGI(TAG, "OTA version: %s", j_version->valuestring);
                    }

                    if (s_ota_cb) {
                        s_ota_cb(j_url->valuestring);
                    }
                    sm_send_event(SM_EVT_OTA_NOTIFY);
                } else {
                    ESP_LOGW(TAG, "OTA notify payload missing 'url' — ignoring");
                }
                cJSON_Delete(root);
            } else {
                ESP_LOGW(TAG, "Failed to parse OTA notify JSON: %s", data);
            }
            break;
        }

        /* Check if this is a command message for relay control */
        char cmd_topic[256];
        snprintf(cmd_topic, sizeof(cmd_topic),
                 "org/%s/device/%s/command",
                 s_cfg.tenant_id, s_cfg.device_id);

        if (strncmp(topic, cmd_topic, strlen(cmd_topic)) == 0) {
            ESP_LOGI(TAG, "Command received: %s", data);

            cJSON *root = cJSON_Parse(data);
            if (root) {
                cJSON *j_relay = cJSON_GetObjectItem(root, "relay");
                cJSON *j_state = cJSON_GetObjectItem(root, "state");

                if (cJSON_IsNumber(j_relay) && cJSON_IsString(j_state)) {
                    uint8_t relay_num = (uint8_t)j_relay->valueint;
                    bool on = (strcmp(j_state->valuestring, "on") == 0);
                    relay_set(relay_num, on);
                } else {
                    ESP_LOGW(TAG, "Command JSON missing 'relay' or 'state' fields");
                }
                cJSON_Delete(root);
            } else {
                ESP_LOGW(TAG, "Failed to parse command JSON: %s", data);
            }
            break;
        }

        break;
    }

    case MQTT_EVENT_ERROR:
        ESP_LOGE(TAG, "MQTT error");
        break;

    default:
        break;
    }
}

/* -----------------------------------------------------------------------
 * Public API
 * --------------------------------------------------------------------- */
void mqtt_manager_start(const device_config_t *cfg)
{
    if (!cfg) return;
    memcpy(&s_cfg, cfg, sizeof(s_cfg));

    /* Build LWT topic */
    char lwt_topic[256];
    snprintf(lwt_topic, sizeof(lwt_topic),
             "org/%s/device/%s/status",
             s_cfg.tenant_id, s_cfg.device_id);

    bool use_tls = (strncmp(s_cfg.mqtt_broker_url, "mqtts://", 8) == 0);

    esp_mqtt_client_config_t mqtt_cfg = {
        .broker = {
            .address.uri   = s_cfg.mqtt_broker_url,
            .verification  = {
                .certificate = use_tls ? isrg_root_x1_pem_start : NULL,
            },
        },
        .credentials = {
            .client_id     = s_cfg.device_id,
            .username      = s_cfg.device_id,
            .authentication = {
                .password  = s_cfg.device_token,
            },
        },
        .session = {
            .keepalive            = 60,
            .disable_clean_session= true,
            .last_will = {
                .topic = lwt_topic,
                .msg   = "offline",
                .qos   = 1,
                .retain= 1,
            },
        },
    };

    s_client = esp_mqtt_client_init(&mqtt_cfg);
    esp_mqtt_client_register_event(s_client, ESP_EVENT_ANY_ID, mqtt_event_handler, NULL);
    esp_mqtt_client_start(s_client);

    ESP_LOGI(TAG, "MQTT client started → %s", s_cfg.mqtt_broker_url);
}

void mqtt_manager_stop(void)
{
    if (s_client) {
        esp_mqtt_client_stop(s_client);
        esp_mqtt_client_destroy(s_client);
        s_client = NULL;
    }
    if (s_heartbeat_task) {
        vTaskDelete(s_heartbeat_task);
        s_heartbeat_task = NULL;
    }
}

esp_err_t mqtt_publish_telemetry(const char *json_payload)
{
    if (!s_client || !json_payload) return ESP_ERR_INVALID_ARG;

    char topic[256];
    snprintf(topic, sizeof(topic),
             "org/%s/device/%s/telemetry",
             s_cfg.tenant_id, s_cfg.device_id);

    int msg_id = esp_mqtt_client_publish(s_client, topic, json_payload, 0, 0, 0);
    return (msg_id >= 0) ? ESP_OK : ESP_FAIL;
}

esp_err_t mqtt_publish_status(const char *status)
{
    if (!s_client || !status) return ESP_ERR_INVALID_ARG;

    char topic[256];
    snprintf(topic, sizeof(topic),
             "org/%s/device/%s/status",
             s_cfg.tenant_id, s_cfg.device_id);

    int msg_id = esp_mqtt_client_publish(s_client, topic, status, 0, 1, 1);
    return (msg_id >= 0) ? ESP_OK : ESP_FAIL;
}

void mqtt_subscribe_ota_notify(mqtt_ota_cb_t cb)
{
    s_ota_cb = cb;
}
