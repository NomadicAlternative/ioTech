/**
 * Relay Driver (1-8 channels, active LOW)
 *
 * Config: { "model": "RELAY", "channels": [
 *   {"num": 1, "gpio": 23, "name": "Relay 1"},
 *   {"num": 2, "gpio": 22, "name": "Relay 2"}
 * ]}
 */
#include "driver.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include <string.h>

#define MAX_RELAYS 8

static const char *TAG = "relay";

typedef struct {
    int num;
    int gpio;
    char name[32];
    bool state;  /* false=off (HIGH), true=on (LOW) — active LOW */
} relay_t;

static relay_t relays[MAX_RELAYS];
static int relay_count = 0;

static bool relay_init(const cJSON *config) {
    const cJSON *channels = cJSON_GetObjectItem(config, "channels");
    if (!channels || !cJSON_IsArray(channels)) {
        ESP_LOGE(TAG, "No channels array");
        return false;
    }

    relay_count = 0;
    for (int i = 0; i < cJSON_GetArraySize(channels) && relay_count < MAX_RELAYS; i++) {
        const cJSON *ch = cJSON_GetArrayItem(channels, i);
        relay_t *r = &relays[relay_count];
        r->num = cJSON_GetObjectItem(ch, "num")->valueint;
        r->gpio = cJSON_GetObjectItem(ch, "gpio")->valueint;
        const cJSON *name = cJSON_GetObjectItem(ch, "name");
        snprintf(r->name, sizeof(r->name), "%s", name ? name->valuestring : "");
        r->state = false;

        gpio_config_t io_conf = {
            .pin_bit_mask = (1ULL << r->gpio),
            .mode = GPIO_MODE_OUTPUT,
            .pull_up_en = GPIO_PULLUP_DISABLE,
            .pull_down_en = GPIO_PULLDOWN_DISABLE,
            .intr_type = GPIO_INTR_DISABLE,
        };
        gpio_config(&io_conf);
        gpio_set_level(r->gpio, 1); /* off = HIGH (active LOW) */
        relay_count++;

        ESP_LOGI(TAG, "Relay %d on GPIO %d", r->num, r->gpio);
    }
    return true;
}

static int relay_read(telemetry_point_t *points, int max) {
    /* Relays don't produce telemetry — get_state handles dashboard display */
    (void)points; (void)max;
    return 0;
}

static bool relay_write(const char *key, const cJSON *value) {
    if (!key || !value) return false;

    /* key format: "relay" or "relay1" */
    int target_num = 0;
    if (strncmp(key, "relay", 5) == 0) {
        target_num = atoi(key + 5);
        if (target_num == 0) target_num = cJSON_GetObjectItem(value, "relay")->valueint;
    }

    const cJSON *state_json = cJSON_GetObjectItem(value, "state");
    bool on = state_json && strcmp(state_json->valuestring, "on") == 0;

    for (int i = 0; i < relay_count; i++) {
        if (relays[i].num == target_num) {
            relays[i].state = on;
            gpio_set_level(relays[i].gpio, on ? 0 : 1); /* active LOW */
            ESP_LOGI(TAG, "Relay %d → %s", target_num, on ? "ON" : "OFF");
            return true;
        }
    }
    return false;
}

static int relay_get_state(telemetry_point_t *points, int max) {
    int n = 0;
    for (int i = 0; i < relay_count && n < max; i++) {
        char key[16];
        snprintf(key, sizeof(key), "relay%d", relays[i].num);
        points[n] = (telemetry_point_t){
            .capability = CAP_RELAY,
            .key = key,
            .value = { .b = relays[i].state },
            .value_type = 2,
        };
        n++;
    }
    return n;
}

static void relay_deinit(void) {
    for (int i = 0; i < relay_count; i++) {
        gpio_set_level(relays[i].gpio, 1);
    }
    relay_count = 0;
}

/* ── Auto-register ──────────────────────────────────────────────────────── */

__attribute__((constructor))
static void register_relay(void) {
    static driver_t drv = {
        .name = "Relay Controller (1-8ch)",
        .model = "RELAY",
        .init = relay_init,
        .read = relay_read,
        .write = relay_write,
        .get_state = relay_get_state,
        .deinit = relay_deinit,
    };
    driver_register(&drv);
}
