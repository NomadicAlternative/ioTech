/**
 * @file test_state_machine.c
 * @brief Unit tests for state machine transition table.
 *
 * S2 FIX: Tests now use sm_get_transition() against the REAL transition
 * table initialised by sm_init_transitions() in state_machine.c, instead
 * of a local mirror that can drift out of sync.
 *
 * Strategy:
 *   1. Provide lightweight stubs for all component APIs that state_machine.c
 *      calls (NVS, WiFi, captive portal, provisioning, MQTT, OTA, factory reset).
 *   2. Include state_machine.c directly in this translation unit.
 *   3. Call sm_init_transitions() (invoked via sm_start stub) then exercise
 *      sm_get_transition() to assert every design-critical path.
 *
 * The FreeRTOS headers are satisfied either by the ESP-IDF toolchain include
 * paths (when built by PlatformIO/espressif32) or by the stub headers in
 * test/mocks/freertos/ (when the project include path is used).
 */

/* -----------------------------------------------------------------------
 * esp_idf_mock.h normally defines sm_event_t via #ifndef STATE_MACHINE_H.
 * We include the REAL state_machine.h through state_machine.c below, so
 * define STATE_MACHINE_H to skip the mock's duplicate enum stubs.
 * --------------------------------------------------------------------- */
#define STATE_MACHINE_H

#include "../../mocks/esp_idf_mock.h"

/* Prevent inclusion of headers whose content is already provided by
 * esp_idf_mock.h (same pattern as test_provisioning.c / test_ota_version.c) */
#define esp_log_h
#define esp_wifi_h
#define esp_ota_ops_h

/* -----------------------------------------------------------------------
 * Component headers — needed for struct/enum type definitions
 * --------------------------------------------------------------------- */
#include "../../components/nvs_storage/include/nvs_storage.h"
#include "../../components/wifi_manager/include/wifi_manager.h"
#include "../../components/captive_portal/include/captive_portal.h"
#include "../../components/provisioning_client/include/provisioning_client.h"
#include "../../components/mqtt_manager/include/mqtt_manager.h"
#include "../../components/ota_manager/include/ota_manager.h"
#include "../../components/factory_reset/include/factory_reset.h"

/* -----------------------------------------------------------------------
 * Component stub implementations.
 * Must be non-static to satisfy extern declarations in the headers above.
 * state_machine.c calls these; they are all no-ops for transition testing.
 * --------------------------------------------------------------------- */
esp_err_t nvs_store_credentials(const wifi_creds_t *c)
    { (void)c; return ESP_OK; }
esp_err_t nvs_load_credentials(wifi_creds_t *out)
    { (void)out; return ESP_ERR_NVS_NOT_FOUND; }
esp_err_t nvs_store_device_config(const device_config_t *c)
    { (void)c; return ESP_OK; }
esp_err_t nvs_load_device_config(device_config_t *out)
    { (void)out; return ESP_ERR_NVS_NOT_FOUND; }
esp_err_t nvs_storage_erase_all(void) { return ESP_OK; }

void wifi_manager_connect(const wifi_creds_t *c) { (void)c; }
void wifi_manager_disconnect(void) {}
void wifi_manager_get_ip(char *b, size_t l)
    { if (b && l > 0) b[0] = '\0'; }

void captive_portal_start(void) {}
void captive_portal_stop(void)  {}

prov_result_t provisioning_client_register(device_config_t *c)
    { (void)c; return PROV_RESULT_ERROR; }
esp_err_t provisioning_build_topic(const device_config_t *c,
    const char *s, char *o, size_t l)
    { (void)c; (void)s; if (o && l > 0) o[0] = '\0'; return ESP_OK; }

void mqtt_manager_start(const device_config_t *c) { (void)c; }
void mqtt_manager_stop(void) {}
esp_err_t mqtt_publish_telemetry(const char *p) { (void)p; return ESP_OK; }
esp_err_t mqtt_publish_status(const char *s)    { (void)s; return ESP_OK; }
void mqtt_subscribe_ota_notify(mqtt_ota_cb_t cb) { (void)cb; }

void ota_manager_start_poll(void) {}
void ota_manager_begin(void) {}
void ota_manager_set_url(const char *u)      { (void)u; }
int  ota_semver_compare(const char *c, const char *l) { (void)c; (void)l; return 0; }

void factory_reset_monitor_start(void) {}
bool factory_reset_should_trigger(uint32_t p, uint32_t t) { return p >= t; }

/* -----------------------------------------------------------------------
 * Include the REAL state machine implementation.
 * sm_init_transitions() initialises s_transitions[STATE_MAX][SM_EVT_MAX]
 * and sm_get_transition() queries it directly.
 * --------------------------------------------------------------------- */
#include "../../components/state_machine/include/state_machine.h"
#include "../../components/state_machine/state_machine.c"

#include <unity.h>

/* -----------------------------------------------------------------------
 * setUp / tearDown — re-initialise the real transition table each test
 * --------------------------------------------------------------------- */
void setUp(void)    { sm_init_transitions(); }
void tearDown(void) {}

/* -----------------------------------------------------------------------
 * Tests: enum sanity (values must never change — they are wire protocol)
 * --------------------------------------------------------------------- */
void test_state_enum_values(void) {
    TEST_ASSERT_EQUAL_INT(0, STATE_INIT);
    TEST_ASSERT_EQUAL_INT(1, STATE_PROVISIONING);
    TEST_ASSERT_EQUAL_INT(2, STATE_CONNECTING);
    TEST_ASSERT_EQUAL_INT(3, STATE_NORMAL);
    TEST_ASSERT_EQUAL_INT(4, STATE_OTA_UPDATE);
    TEST_ASSERT_EQUAL_INT(5, STATE_FACTORY_RESET);
    TEST_ASSERT_EQUAL_INT(6, STATE_ERROR);
    TEST_ASSERT_EQUAL_INT(7, STATE_MAX);
}

void test_event_enum_values(void) {
    TEST_ASSERT_EQUAL_INT(0,  SM_EVT_NVS_CREDS_FOUND);
    TEST_ASSERT_EQUAL_INT(1,  SM_EVT_NVS_CREDS_MISSING);
    TEST_ASSERT_EQUAL_INT(2,  SM_EVT_PORTAL_FORM_OK);
    TEST_ASSERT_EQUAL_INT(3,  SM_EVT_WIFI_CONNECTED);
    TEST_ASSERT_EQUAL_INT(4,  SM_EVT_WIFI_FAILED);
    TEST_ASSERT_EQUAL_INT(9,  SM_EVT_MQTT_CONNECTED);
    TEST_ASSERT_EQUAL_INT(11, SM_EVT_OTA_NOTIFY);
    TEST_ASSERT_EQUAL_INT(14, SM_EVT_OTA_FAILED);
    TEST_ASSERT_EQUAL_INT(15, SM_EVT_FACTORY_RESET);
    TEST_ASSERT_EQUAL_INT(16, SM_EVT_ERROR);
    TEST_ASSERT_EQUAL_INT(17, SM_EVT_MAX);
}

/* -----------------------------------------------------------------------
 * Tests: critical happy-path transitions (via REAL table)
 * --------------------------------------------------------------------- */
void test_init_creds_found_goes_connecting(void) {
    TEST_ASSERT_EQUAL_INT(STATE_CONNECTING,
        sm_get_transition(STATE_INIT, SM_EVT_NVS_CREDS_FOUND));
}

void test_init_creds_missing_goes_provisioning(void) {
    TEST_ASSERT_EQUAL_INT(STATE_PROVISIONING,
        sm_get_transition(STATE_INIT, SM_EVT_NVS_CREDS_MISSING));
}

void test_provisioning_form_ok_goes_connecting(void) {
    TEST_ASSERT_EQUAL_INT(STATE_CONNECTING,
        sm_get_transition(STATE_PROVISIONING, SM_EVT_PORTAL_FORM_OK));
}

void test_connecting_wifi_ok_goes_normal(void) {
    TEST_ASSERT_EQUAL_INT(STATE_NORMAL,
        sm_get_transition(STATE_CONNECTING, SM_EVT_WIFI_CONNECTED));
}

void test_connecting_wifi_fail_goes_provisioning(void) {
    TEST_ASSERT_EQUAL_INT(STATE_PROVISIONING,
        sm_get_transition(STATE_CONNECTING, SM_EVT_WIFI_FAILED));
}

void test_normal_ota_notify_goes_ota_update(void) {
    TEST_ASSERT_EQUAL_INT(STATE_OTA_UPDATE,
        sm_get_transition(STATE_NORMAL, SM_EVT_OTA_NOTIFY));
}

void test_normal_ota_poll_goes_ota_update(void) {
    TEST_ASSERT_EQUAL_INT(STATE_OTA_UPDATE,
        sm_get_transition(STATE_NORMAL, SM_EVT_OTA_POLL));
}

void test_ota_complete_goes_normal(void) {
    TEST_ASSERT_EQUAL_INT(STATE_NORMAL,
        sm_get_transition(STATE_OTA_UPDATE, SM_EVT_OTA_COMPLETE));
}

void test_ota_failed_goes_normal(void) {
    TEST_ASSERT_EQUAL_INT(STATE_NORMAL,
        sm_get_transition(STATE_OTA_UPDATE, SM_EVT_OTA_FAILED));
}

/* -----------------------------------------------------------------------
 * C1 FIX test: SM_EVT_NVS_CREDS_FOUND (event==0) must not be mistaken
 * for "no transition defined".  sentinel is STATE_MAX, not 0 (STATE_INIT).
 * --------------------------------------------------------------------- */
void test_event_zero_not_treated_as_no_transition(void) {
    /* SM_EVT_NVS_CREDS_FOUND == 0 must yield STATE_CONNECTING, not STATE_MAX */
    TEST_ASSERT_EQUAL_INT(STATE_CONNECTING,
        sm_get_transition(STATE_INIT, (sm_event_t)0));
}

/* -----------------------------------------------------------------------
 * Tests: STATE_MAX sentinel for undefined transitions
 * --------------------------------------------------------------------- */
void test_undefined_transition_returns_state_max(void) {
    /* STATE_PROVISIONING has no transition for SM_EVT_WIFI_CONNECTED */
    TEST_ASSERT_EQUAL_INT(STATE_MAX,
        sm_get_transition(STATE_PROVISIONING, SM_EVT_WIFI_CONNECTED));
}

void test_out_of_range_state_returns_state_max(void) {
    TEST_ASSERT_EQUAL_INT(STATE_MAX,
        sm_get_transition(STATE_MAX, SM_EVT_NVS_CREDS_FOUND));
}

void test_out_of_range_event_returns_state_max(void) {
    TEST_ASSERT_EQUAL_INT(STATE_MAX,
        sm_get_transition(STATE_INIT, SM_EVT_MAX));
}

/* -----------------------------------------------------------------------
 * Tests: factory reset from any interruptible state
 * --------------------------------------------------------------------- */
void test_factory_reset_from_provisioning(void) {
    TEST_ASSERT_EQUAL_INT(STATE_FACTORY_RESET,
        sm_get_transition(STATE_PROVISIONING, SM_EVT_FACTORY_RESET));
}

void test_factory_reset_from_connecting(void) {
    TEST_ASSERT_EQUAL_INT(STATE_FACTORY_RESET,
        sm_get_transition(STATE_CONNECTING, SM_EVT_FACTORY_RESET));
}

void test_factory_reset_from_normal(void) {
    TEST_ASSERT_EQUAL_INT(STATE_FACTORY_RESET,
        sm_get_transition(STATE_NORMAL, SM_EVT_FACTORY_RESET));
}

/* -----------------------------------------------------------------------
 * Tests: error transitions
 * --------------------------------------------------------------------- */
void test_error_from_init(void) {
    TEST_ASSERT_EQUAL_INT(STATE_ERROR,
        sm_get_transition(STATE_INIT, SM_EVT_ERROR));
}

void test_error_from_provisioning(void) {
    TEST_ASSERT_EQUAL_INT(STATE_ERROR,
        sm_get_transition(STATE_PROVISIONING, SM_EVT_ERROR));
}

void test_error_from_connecting(void) {
    TEST_ASSERT_EQUAL_INT(STATE_ERROR,
        sm_get_transition(STATE_CONNECTING, SM_EVT_ERROR));
}

void test_error_from_normal(void) {
    TEST_ASSERT_EQUAL_INT(STATE_ERROR,
        sm_get_transition(STATE_NORMAL, SM_EVT_ERROR));
}

void test_error_from_ota_update(void) {
    TEST_ASSERT_EQUAL_INT(STATE_ERROR,
        sm_get_transition(STATE_OTA_UPDATE, SM_EVT_ERROR));
}

/* -----------------------------------------------------------------------
 * Tests: self-transitions in STATE_NORMAL
 * --------------------------------------------------------------------- */
void test_normal_mqtt_connected_stays_normal(void) {
    TEST_ASSERT_EQUAL_INT(STATE_NORMAL,
        sm_get_transition(STATE_NORMAL, SM_EVT_MQTT_CONNECTED));
}

void test_normal_mqtt_disconnected_stays_normal(void) {
    TEST_ASSERT_EQUAL_INT(STATE_NORMAL,
        sm_get_transition(STATE_NORMAL, SM_EVT_MQTT_DISCONNECTED));
}

/* -----------------------------------------------------------------------
 * Runner
 * --------------------------------------------------------------------- */
int main(void) {
    UNITY_BEGIN();

    RUN_TEST(test_state_enum_values);
    RUN_TEST(test_event_enum_values);

    RUN_TEST(test_event_zero_not_treated_as_no_transition);
    RUN_TEST(test_undefined_transition_returns_state_max);
    RUN_TEST(test_out_of_range_state_returns_state_max);
    RUN_TEST(test_out_of_range_event_returns_state_max);

    RUN_TEST(test_init_creds_found_goes_connecting);
    RUN_TEST(test_init_creds_missing_goes_provisioning);
    RUN_TEST(test_provisioning_form_ok_goes_connecting);
    RUN_TEST(test_connecting_wifi_ok_goes_normal);
    RUN_TEST(test_connecting_wifi_fail_goes_provisioning);
    RUN_TEST(test_normal_ota_notify_goes_ota_update);
    RUN_TEST(test_normal_ota_poll_goes_ota_update);
    RUN_TEST(test_ota_complete_goes_normal);
    RUN_TEST(test_ota_failed_goes_normal);

    RUN_TEST(test_factory_reset_from_provisioning);
    RUN_TEST(test_factory_reset_from_connecting);
    RUN_TEST(test_factory_reset_from_normal);

    RUN_TEST(test_error_from_init);
    RUN_TEST(test_error_from_provisioning);
    RUN_TEST(test_error_from_connecting);
    RUN_TEST(test_error_from_normal);
    RUN_TEST(test_error_from_ota_update);

    RUN_TEST(test_normal_mqtt_connected_stays_normal);
    RUN_TEST(test_normal_mqtt_disconnected_stays_normal);

    return UNITY_END();
}
