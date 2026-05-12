/**
 * Driver Registry — capability → driver mapping.
 *
 * All compiled-in drivers auto-register via driver_register().
 * Only drivers whose model appears in the provisioning config get activated.
 */
#include "driver.h"
#include "esp_log.h"
#include <string.h>

#define MAX_DRIVERS 64

static driver_t *registry[MAX_DRIVERS];
static int registered = 0;
static driver_t *active[MAX_DRIVERS];
static int active_count = 0;

static const char *TAG = "driver";

void driver_register(driver_t *driver) {
    if (registered >= MAX_DRIVERS) {
        ESP_LOGE(TAG, "Driver registry full — can't register %s", driver->name);
        return;
    }
    registry[registered++] = driver;
    ESP_LOGI(TAG, "Registered driver: %s (%s)", driver->name, driver->model);
}

int driver_activate_all(const cJSON *config) {
    const cJSON *drivers = cJSON_GetObjectItem(config, "drivers");
    if (!drivers || !cJSON_IsArray(drivers)) {
        ESP_LOGW(TAG, "No drivers array in provisioning config");
        return 0;
    }

    int activated = 0;
    for (int i = 0; i < cJSON_GetArraySize(drivers); i++) {
        const cJSON *entry = cJSON_GetArrayItem(drivers, i);
        const cJSON *model_json = cJSON_GetObjectItem(entry, "model");
        if (!model_json || !cJSON_IsString(model_json)) continue;

        const char *model = model_json->valuestring;
        for (int j = 0; j < registered; j++) {
            if (strcmp(registry[j]->model, model) == 0) {
                if (registry[j]->init(entry)) {
                    active[active_count++] = registry[j];
                    activated++;
                    ESP_LOGI(TAG, "Activated: %s", registry[j]->name);
                } else {
                    ESP_LOGE(TAG, "Failed to init: %s", registry[j]->name);
                }
                break;
            }
        }
    }
    return activated;
}

int driver_read_all_telemetry(char *buf, int buf_len) {
    if (active_count == 0) return 0;

    telemetry_point_t points[32];
    int total = 0;

    for (int i = 0; i < active_count; i++) {
        driver_t *d = active[i];
        if (d->read) {
            int n = d->read(points + total, 32 - total);
            total += n;
            if (total >= 32) break;
        }
    }

    if (total == 0) return 0;

    // Build JSON
    cJSON *root = cJSON_CreateObject();
    for (int i = 0; i < total; i++) {
        telemetry_point_t *p = &points[i];
        cJSON *item = cJSON_CreateObject();
        cJSON_AddStringToObject(item, "capability", capability_type_str(p->capability));
        cJSON_AddNumberToObject(item, "value", p->value.f);  // simplified
        if (p->unit) cJSON_AddStringToObject(item, "unit", p->unit);
        cJSON_AddItemToObject(root, p->key, item);
    }

    char *json_str = cJSON_PrintUnformatted(root);
    int len = strlen(json_str);
    if (len < buf_len) {
        memcpy(buf, json_str, len + 1);
    } else {
        len = 0;
    }
    cJSON_free(json_str);
    cJSON_Delete(root);
    return len;
}

bool driver_write_command(const char *topic, const cJSON *payload) {
    for (int i = 0; i < active_count; i++) {
        if (active[i]->write && active[i]->write(topic, payload)) {
            return true;
        }
    }
    return false;
}

/* ── Helper ─────────────────────────────────────────────────────────────── */

const char *capability_type_str(capability_type_t cap) {
    switch (cap) {
        case CAP_TEMPERATURE: return "temperature";
        case CAP_HUMIDITY:    return "humidity";
        case CAP_PRESSURE:    return "pressure";
        case CAP_MOTION:      return "motion";
        case CAP_LIGHT_LUX:   return "light";
        case CAP_RELAY:       return "relay";
        case CAP_SERVO:       return "servo";
        case CAP_OLED:        return "oled";
        default:              return "unknown";
    }
}
