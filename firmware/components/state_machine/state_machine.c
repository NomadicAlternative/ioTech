#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "esp_log.h"
#include "esp_wifi.h"
#include "esp_ota_ops.h"

#include "state_machine.h"
#include "nvs_storage.h"
#include "wifi_manager.h"
#include "captive_portal.h"
#include "provisioning_client.h"
#include "mqtt_manager.h"
#include "ota_manager.h"
#include "factory_reset.h"
#include "serial_provisioning.h"
#include "io_driver.h"

static const char *TAG = "state_machine";

/* Event queue — holds up to 16 events */
#define SM_QUEUE_LEN 16
static QueueHandle_t s_evt_queue = NULL;
static volatile sm_state_t s_current_state = STATE_INIT;

/* -----------------------------------------------------------------------
 * Forward declarations of state entry handlers
 * --------------------------------------------------------------------- */
static void state_enter_init(void);
static void state_enter_provisioning(void);
static void state_enter_connecting(void);
static void state_enter_normal(void);
static void state_enter_ota_update(void);
static void state_enter_factory_reset(void);
static void state_enter_error(void);

/* -----------------------------------------------------------------------
 * State entry handler table
 * --------------------------------------------------------------------- */
typedef void (*state_entry_fn_t)(void);
static const state_entry_fn_t s_entry_handlers[STATE_MAX] = {
    [STATE_INIT]          = state_enter_init,
    [STATE_PROVISIONING]  = state_enter_provisioning,
    [STATE_CONNECTING]    = state_enter_connecting,
    [STATE_NORMAL]        = state_enter_normal,
    [STATE_OTA_UPDATE]    = state_enter_ota_update,
    [STATE_FACTORY_RESET] = state_enter_factory_reset,
    [STATE_ERROR]         = state_enter_error,
};

/* -----------------------------------------------------------------------
 * State transition table
 * State × Event → next state  (STATE_MAX = no transition / invalid)
 *
 * Initialised programmatically in sm_init_transitions() so that every
 * unset slot defaults to STATE_MAX instead of 0 (STATE_INIT), which
 * would otherwise create a false "go to INIT" for unknown events.
 * --------------------------------------------------------------------- */
static sm_state_t s_transitions[STATE_MAX][SM_EVT_MAX];

static void sm_init_transitions(void)
{
    /* Fill everything with STATE_MAX (= no transition defined) */
    for (int s = 0; s < STATE_MAX; s++) {
        for (int e = 0; e < SM_EVT_MAX; e++) {
            s_transitions[s][e] = STATE_MAX;
        }
    }

    /* STATE_INIT */
    s_transitions[STATE_INIT][SM_EVT_NVS_CREDS_FOUND]   = STATE_CONNECTING;
    s_transitions[STATE_INIT][SM_EVT_NVS_CREDS_MISSING] = STATE_PROVISIONING;
    s_transitions[STATE_INIT][SM_EVT_ERROR]              = STATE_ERROR;

    /* STATE_PROVISIONING */
    s_transitions[STATE_PROVISIONING][SM_EVT_PORTAL_FORM_OK]  = STATE_CONNECTING;
    s_transitions[STATE_PROVISIONING][SM_EVT_FACTORY_RESET]   = STATE_FACTORY_RESET;
    s_transitions[STATE_PROVISIONING][SM_EVT_ERROR]           = STATE_ERROR;

    /* STATE_CONNECTING */
    s_transitions[STATE_CONNECTING][SM_EVT_WIFI_CONNECTED] = STATE_NORMAL;
    s_transitions[STATE_CONNECTING][SM_EVT_WIFI_FAILED]    = STATE_PROVISIONING;
    s_transitions[STATE_CONNECTING][SM_EVT_FACTORY_RESET]  = STATE_FACTORY_RESET;
    s_transitions[STATE_CONNECTING][SM_EVT_ERROR]          = STATE_ERROR;

    /* STATE_NORMAL */
    s_transitions[STATE_NORMAL][SM_EVT_MQTT_CONNECTED]    = STATE_NORMAL;   /* stay; mark rollback */
    s_transitions[STATE_NORMAL][SM_EVT_MQTT_DISCONNECTED] = STATE_NORMAL;   /* stay; backoff reconnect */
    s_transitions[STATE_NORMAL][SM_EVT_OTA_NOTIFY]        = STATE_OTA_UPDATE;
    s_transitions[STATE_NORMAL][SM_EVT_OTA_POLL]          = STATE_OTA_UPDATE;
    s_transitions[STATE_NORMAL][SM_EVT_FACTORY_RESET]     = STATE_FACTORY_RESET;
    s_transitions[STATE_NORMAL][SM_EVT_ERROR]             = STATE_ERROR;

    /* STATE_OTA_UPDATE */
    s_transitions[STATE_OTA_UPDATE][SM_EVT_OTA_COMPLETE] = STATE_NORMAL;   /* reboot happens in handler */
    s_transitions[STATE_OTA_UPDATE][SM_EVT_OTA_FAILED]   = STATE_NORMAL;
    s_transitions[STATE_OTA_UPDATE][SM_EVT_ERROR]        = STATE_ERROR;

    /* STATE_FACTORY_RESET / STATE_ERROR: no outgoing transitions — device reboots */
}

/* -----------------------------------------------------------------------
 * State entry handlers
 * --------------------------------------------------------------------- */
static void state_enter_init(void)
{
    ESP_LOGI(TAG, "[INIT] Checking NVS for credentials...");

    wifi_creds_t wifi_creds = {0};
    device_config_t dev_cfg = {0};

    bool has_wifi = (nvs_load_credentials(&wifi_creds) == ESP_OK);

    /* device_config (device_token, mqtt_url, etc.) is only needed in NORMAL.
     * On first boot after captive-portal provisioning only claim_token +
     * backend_url are present — that is fine, HTTP provisioning fills the rest. */
    (void)nvs_load_device_config(&dev_cfg);

    /* Always try serial provisioning first — allows re-provisioning even when
     * NVS already has credentials (e.g. IP address changed). */
    ESP_LOGI(TAG, "[INIT] Trying serial provisioning first...");
    if (serial_provisioning_receive()) {
        ESP_LOGI(TAG, "[INIT] Serial provisioning succeeded — going CONNECTING");
        sm_send_event(SM_EVT_NVS_CREDS_FOUND);
    } else if (has_wifi) {
        ESP_LOGI(TAG, "[INIT] No serial data — WiFi credentials found in NVS, going CONNECTING");
        sm_send_event(SM_EVT_NVS_CREDS_FOUND);
    } else {
        ESP_LOGI(TAG, "[INIT] No serial data and no NVS credentials — going PROVISIONING (captive portal)");
        sm_send_event(SM_EVT_NVS_CREDS_MISSING);
    }
}

static void on_portal_done(void)
{
    sm_send_event(SM_EVT_PORTAL_FORM_OK);
}

static void state_enter_provisioning(void)
{
    ESP_LOGI(TAG, "[PROVISIONING] Starting captive portal");
    captive_portal_start(on_portal_done);
}

static void state_enter_connecting(void)
{
    /* W1 FIX: Stop captive portal SoftAP+DNS+HTTP if it was running */
    captive_portal_stop();

    ESP_LOGI(TAG, "[CONNECTING] Connecting to WiFi...");
    wifi_creds_t creds = {0};
    if (nvs_load_credentials(&creds) != ESP_OK) {
        ESP_LOGE(TAG, "[CONNECTING] Cannot load WiFi credentials");
        sm_send_event(SM_EVT_ERROR);
        return;
    }
    wifi_manager_connect(&creds);
    /* wifi_manager sends SM_EVT_WIFI_CONNECTED or SM_EVT_WIFI_FAILED */
}

static void state_enter_normal(void)
{
    static bool prov_done   = false;
    static bool mqtt_started = false;
    static bool ota_started  = false;
    static bool fr_started   = false;

    /* ------------------------------------------------------------------
     * C2 FIX: If device_token is absent, run HTTP provisioning first.
     * This happens on first boot after captive-portal WiFi provisioning —
     * the claim_token is present but no device_token yet.
     * ------------------------------------------------------------------ */
    if (!prov_done) {
        device_config_t cfg = {0};
        /* nvs_load_device_config may fail on first boot (no device_token yet).
         * That is fine — we only need backend_url + claim_token to provision.
         * Read what we have and fall through to the device_token check. */
        nvs_load_device_config(&cfg);

        ESP_LOGI(TAG, "[NORMAL] backend_url='%s' claim_token='%s'",
                 cfg.backend_url, cfg.claim_token);

        if (strlen(cfg.device_token) == 0) {
            ESP_LOGI(TAG, "[NORMAL] No device token found — running HTTP provisioning");
            prov_result_t result = provisioning_client_register(&cfg);
            if (result == PROV_RESULT_OK) {
                ESP_LOGI(TAG, "[NORMAL] Provisioning successful — device token stored");
            } else if (result == PROV_RESULT_INVALID) {
                /* Bad claim_token — go back to captive portal for new token */
                ESP_LOGW(TAG, "[NORMAL] Invalid claim token — restarting provisioning");
                prov_done = false;
                sm_send_event(SM_EVT_WIFI_FAILED);  /* re-enters provisioning */
                return;
            } else {
                ESP_LOGE(TAG, "[NORMAL] Provisioning failed (result=%d)", (int)result);
                sm_send_event(SM_EVT_ERROR);
                return;
            }
        }
        prov_done = true;
    }

    /* ------------------------------------------------------------------
     * Start MQTT manager (once only)
     * ------------------------------------------------------------------ */
    if (!mqtt_started) {
        ESP_LOGI(TAG, "[NORMAL] Starting MQTT manager");
        device_config_t cfg = {0};
        if (nvs_load_device_config(&cfg) == ESP_OK) {
            mqtt_manager_start(&cfg);
            mqtt_started = true;

            /* Load drivers from NVS config after MQTT is up */
            ESP_LOGI(TAG, "[NORMAL] Loading drivers from NVS");
            drv_err_t drv_err = io_driver_load_all_from_nvs();
            if (drv_err != DRV_OK) {
                ESP_LOGW(TAG, "[NORMAL] io_driver_load_all_from_nvs returned %s",
                         drv_err_str(drv_err));
            }

            /* Always load board defaults as complement to NVS config.
             * io_driver_load() is idempotent — already-active drivers are skipped. */
            io_driver_load_all_defaults();
        } else {
            ESP_LOGE(TAG, "[NORMAL] Cannot load device config for MQTT");
            sm_send_event(SM_EVT_ERROR);
            return;
        }
    }

    /* W4 FIX: guard duplicate task creation on STATE_NORMAL re-entry */
    if (!ota_started) {
        ota_manager_start_poll();
        ota_started = true;
    }
    if (!fr_started) {
        factory_reset_monitor_start();
        fr_started = true;
    }
}

static void state_enter_ota_update(void)
{
    ESP_LOGI(TAG, "[OTA_UPDATE] Starting OTA download...");
    ota_manager_begin();
    /* ota_manager sends SM_EVT_OTA_COMPLETE or SM_EVT_OTA_FAILED */
}

static void state_enter_factory_reset(void)
{
    ESP_LOGI(TAG, "[FACTORY_RESET] Erasing NVS and rebooting...");
    nvs_storage_erase_all();
    vTaskDelay(pdMS_TO_TICKS(1000));
    esp_restart();
}

static void state_enter_error(void)
{
    ESP_LOGE(TAG, "[ERROR] Unrecoverable error. Rebooting in 5s...");
    vTaskDelay(pdMS_TO_TICKS(5000));
    esp_restart();
}

/* -----------------------------------------------------------------------
 * State machine task
 * --------------------------------------------------------------------- */
static void sm_task(void *arg)
{
    sm_event_t event;

    /* Enter initial state */
    s_current_state = STATE_INIT;
    if (s_entry_handlers[STATE_INIT]) {
        s_entry_handlers[STATE_INIT]();
    }

    for (;;) {
        if (xQueueReceive(s_evt_queue, &event, portMAX_DELAY) != pdTRUE) {
            continue;
        }

        ESP_LOGI(TAG, "Event %d received in state %d", (int)event, (int)s_current_state);

        if (event >= SM_EVT_MAX) {
            ESP_LOGW(TAG, "Unknown event %d — ignored", (int)event);
            continue;
        }

        sm_state_t next = s_transitions[s_current_state][event];

        if (next == STATE_MAX) {
            /* STATE_MAX is the sentinel for "no transition defined" */
            ESP_LOGW(TAG, "No transition defined for state=%d event=%d",
                     (int)s_current_state, (int)event);
            continue;
        }

        if (next == s_current_state) {
            /* Self-transition for events like MQTT_CONNECTED in NORMAL */
            ESP_LOGD(TAG, "Self-transition in state %d for event %d",
                     (int)s_current_state, (int)event);
            /* Still call special in-state handlers */
            if (s_current_state == STATE_NORMAL && event == SM_EVT_MQTT_CONNECTED) {
                ESP_LOGI(TAG, "[NORMAL] MQTT connected — marking OTA partition valid");
                esp_ota_mark_app_valid_cancel_rollback();
            }
            continue;
        }

        ESP_LOGI(TAG, "Transition: %d → %d", (int)s_current_state, (int)next);
        s_current_state = next;

        if (s_entry_handlers[next]) {
            s_entry_handlers[next]();
        }
    }
}

/* -----------------------------------------------------------------------
 * Public API
 * --------------------------------------------------------------------- */
void sm_start(void)
{
    sm_init_transitions();

    s_evt_queue = xQueueCreate(SM_QUEUE_LEN, sizeof(sm_event_t));
    configASSERT(s_evt_queue != NULL);

    xTaskCreate(sm_task, "state_machine", 8192, NULL, 5, NULL);
}

void sm_send_event(sm_event_t event)
{
    if (s_evt_queue == NULL) {
        ESP_LOGE(TAG, "sm_send_event called before sm_start()");
        return;
    }
    /* Use FromISR variant if called from ISR context */
    BaseType_t from_isr = xPortInIsrContext();
    if (from_isr) {
        BaseType_t higher_priority_woken = pdFALSE;
        xQueueSendFromISR(s_evt_queue, &event, &higher_priority_woken);
        portYIELD_FROM_ISR(higher_priority_woken);
    } else {
        xQueueSend(s_evt_queue, &event, pdMS_TO_TICKS(100));
    }
}

sm_state_t sm_get_state(void)
{
    return s_current_state;
}

sm_state_t sm_get_transition(sm_state_t state, sm_event_t event)
{
    if (state >= STATE_MAX || event >= SM_EVT_MAX) return STATE_MAX;
    return s_transitions[state][event];
}
