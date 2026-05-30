#include <string.h>
#include <time.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "esp_log.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "esp_netif_sntp.h"
#include "esp_sntp.h"
#include "lwip/ip4_addr.h"

#include "wifi_manager.h"
#include "sm_events.h"

static const char *TAG = "wifi_manager";

#define WIFI_CONNECTED_BIT  BIT0
#define WIFI_FAIL_BIT       BIT1
#define WIFI_CONNECT_TIMEOUT_MS  30000

static EventGroupHandle_t s_wifi_event_group = NULL;
static int s_retry_count = 0;
#define MAX_RETRY 5

/* Guards to prevent double-initialisation on re-entry into STATE_CONNECTING */
static bool s_netif_inited    = false;
static bool s_wifi_inited     = false;

/* -----------------------------------------------------------------------
 * SNTP time synchronisation
 *
 * TLS certificate verification requires the system clock to be within
 * the certificate's validity window (not Jan 1 2000).  SNTP sync is
 * started as soon as the STA interface receives an IP address.
 *
 * Uses esp_netif_sntp API (ESP-IDF ≥ 5.1) with multiple servers for
 * resilience against blocked NTP servers or DNS failures.
 * --------------------------------------------------------------------- */
static bool s_sntp_done = false;

static void sntp_sync(void)
{
    if (s_sntp_done) return;

    /* Set timezone to UTC — certificate validity is in UTC */
    setenv("TZ", "UTC0", 1);
    tzset();

    esp_sntp_config_t config = {
        .smooth_sync = false,
        .server_from_dhcp = false,
        .wait_for_sync = true,
        .start = true,
        .sync_cb = NULL,
        .renew_servers_after_new_IP = false,
        .ip_event_to_renew = IP_EVENT_STA_GOT_IP,
        .index_of_first_server = 0,
        .num_of_servers = 1,
        .servers = { "pool.ntp.org" },
    };

    esp_netif_sntp_init(&config);

    /* Wait up to 20 s across 3 servers */
    int retry = 0;
    while (esp_netif_sntp_sync_wait(pdMS_TO_TICKS(2000)) == ESP_ERR_TIMEOUT
           && ++retry < 10) {
        ESP_LOGD(TAG, "Waiting for SNTP sync... (%d/10)", retry);
    }

    if (sntp_get_sync_status() == SNTP_SYNC_STATUS_RESET) {
        esp_netif_sntp_deinit();
        ESP_LOGW(TAG, "SNTP sync timed out — TLS may fail");
        return;
    }

    s_sntp_done = true;
    time_t now;
    time(&now);
    struct tm timeinfo;
    localtime_r(&now, &timeinfo);
    ESP_LOGI(TAG, "SNTP synced — system time: %04d-%02d-%02d %02d:%02d:%02d",
             timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday,
             timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
}

static void wifi_event_handler(void *arg, esp_event_base_t event_base,
                                int32_t event_id, void *event_data)
{
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        if (s_retry_count < MAX_RETRY) {
            esp_wifi_connect();
            s_retry_count++;
            ESP_LOGW(TAG, "WiFi disconnected — retrying (%d/%d)", s_retry_count, MAX_RETRY);
        } else {
            ESP_LOGE(TAG, "WiFi connection failed after %d attempts", MAX_RETRY);
            xEventGroupSetBits(s_wifi_event_group, WIFI_FAIL_BIT);
        }
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t *event = (ip_event_got_ip_t *)event_data;
        ESP_LOGI(TAG, "Got IP: " IPSTR, IP2STR(&event->ip_info.ip));
        s_retry_count = 0;
        sntp_sync();  /* sync system clock before any TLS connection */
        xEventGroupSetBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
    }
}

void wifi_manager_connect(const wifi_creds_t *creds)
{
    if (!creds) {
        sm_send_event(SM_EVT_ERROR);
        return;
    }

    s_wifi_event_group = xEventGroupCreate();
    s_retry_count      = 0;

    if (!s_netif_inited) {
        ESP_ERROR_CHECK(esp_netif_init());
        esp_netif_create_default_wifi_sta();
        s_netif_inited = true;
    }

    if (!s_wifi_inited) {
        wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
        ESP_ERROR_CHECK(esp_wifi_init(&cfg));
        s_wifi_inited = true;
    }

    esp_event_handler_instance_t instance_any_id;
    esp_event_handler_instance_t instance_got_ip;

    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT,
                                                         ESP_EVENT_ANY_ID,
                                                         &wifi_event_handler,
                                                         NULL,
                                                         &instance_any_id));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT,
                                                         IP_EVENT_STA_GOT_IP,
                                                         &wifi_event_handler,
                                                         NULL,
                                                         &instance_got_ip));

    ESP_LOGI(TAG, "Attempting WiFi connection — SSID: '%s' PASS_LEN: %d",
             creds->ssid, (int)strlen(creds->password));

    wifi_config_t wifi_config = {0};
    strlcpy((char *)wifi_config.sta.ssid,     creds->ssid,     sizeof(wifi_config.sta.ssid));
    strlcpy((char *)wifi_config.sta.password, creds->password, sizeof(wifi_config.sta.password));
    wifi_config.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());

    EventBits_t bits = xEventGroupWaitBits(s_wifi_event_group,
                                           WIFI_CONNECTED_BIT | WIFI_FAIL_BIT,
                                           pdFALSE, pdFALSE,
                                           pdMS_TO_TICKS(WIFI_CONNECT_TIMEOUT_MS));

    if (bits & WIFI_CONNECTED_BIT) {
        ESP_LOGI(TAG, "Connected to SSID: %s", creds->ssid);
        sm_send_event(SM_EVT_WIFI_CONNECTED);
    } else {
        ESP_LOGE(TAG, "Failed to connect to SSID: %s", creds->ssid);
        sm_send_event(SM_EVT_WIFI_FAILED);
    }

    /* Cleanup event handlers */
    esp_event_handler_instance_unregister(IP_EVENT, IP_EVENT_STA_GOT_IP, instance_got_ip);
    esp_event_handler_instance_unregister(WIFI_EVENT, ESP_EVENT_ANY_ID, instance_any_id);
    vEventGroupDelete(s_wifi_event_group);
    s_wifi_event_group = NULL;
}

void wifi_manager_disconnect(void)
{
    esp_wifi_disconnect();
    esp_wifi_stop();
    ESP_LOGI(TAG, "WiFi disconnected");
}

void wifi_manager_get_ip(char *buf, size_t buf_len)
{
    esp_netif_t *netif = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
    if (!netif) {
        strlcpy(buf, "192.168.4.1", buf_len);
        return;
    }
    esp_netif_ip_info_t ip_info;
    if (esp_netif_get_ip_info(netif, &ip_info) == ESP_OK) {
        snprintf(buf, buf_len, IPSTR, IP2STR(&ip_info.ip));
    } else {
        strlcpy(buf, "192.168.4.1", buf_len);
    }
}
