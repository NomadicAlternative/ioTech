/**
 * @file test_integration.c
 * @brief Basic integration tests for the NVS → provisioning → topic pipeline.
 *
 * Tests the end-to-end data flow that occurs at runtime:
 *   1. Store WiFi credentials and device config in NVS.
 *   2. Load them back — verify round-trip integrity.
 *   3. Build MQTT topics using the loaded config.
 *   4. Verify hardware_id is populated by provisioning_client_register().
 *   5. Verify NVS erase clears everything (factory reset path).
 *
 * All tests run on native (host) using in-memory NVS mock.
 */

#include "../../mocks/esp_idf_mock.h"

/* Stub asm cert symbols (required by provisioning_client.c and ota_manager) */
const char isrg_root_x1_pem_start[] = "MOCK_CERT_PEM";
const char isrg_root_x1_pem_end[]   = "";

/* Pull in components under test */
#include "../../components/nvs_storage/include/nvs_storage.h"
#include "../../components/nvs_storage/nvs_storage.c"

#include "../../components/provisioning_client/include/provisioning_client.h"
#include "../../components/provisioning_client/provisioning_client.c"

#include <unity.h>
#include <string.h>

/* -----------------------------------------------------------------------
 * setUp / tearDown
 * --------------------------------------------------------------------- */
void setUp(void)    { mock_nvs_reset(); }
void tearDown(void) { last_sm_event = SM_EVT_MAX; }

/* -----------------------------------------------------------------------
 * Integration: WiFi creds → NVS → load
 * --------------------------------------------------------------------- */
void test_integration_store_and_load_wifi_creds(void) {
    wifi_creds_t in  = { .ssid = "HomeWiFi", .password = "P@ssword1!" };
    wifi_creds_t out = {0};

    TEST_ASSERT_EQUAL_INT(ESP_OK, nvs_store_credentials(&in));
    TEST_ASSERT_EQUAL_INT(ESP_OK, nvs_load_credentials(&out));
    TEST_ASSERT_EQUAL_STRING(in.ssid,     out.ssid);
    TEST_ASSERT_EQUAL_STRING(in.password, out.password);
}

/* -----------------------------------------------------------------------
 * Integration: Device config → NVS → load → build topics
 * --------------------------------------------------------------------- */
void test_integration_device_config_to_mqtt_topic(void) {
    device_config_t in = {
        .device_token    = "Bearer-Token-XYZ",
        .tenant_id       = "iotech-demo",
        .device_id       = "sensor-floor-1",
        .mqtt_broker_url = "mqtts://mqtt.iotech.io:8883",
        .backend_url     = "https://api.iotech.io",
        .hardware_id     = "aabbccddeeff",
    };
    device_config_t out = {0};

    TEST_ASSERT_EQUAL_INT(ESP_OK, nvs_store_device_config(&in));
    TEST_ASSERT_EQUAL_INT(ESP_OK, nvs_load_device_config(&out));

    /* Build telemetry topic using loaded config */
    char topic[256] = {0};
    TEST_ASSERT_EQUAL_INT(ESP_OK,
        provisioning_build_topic(&out, "telemetry", topic, sizeof(topic)));
    TEST_ASSERT_EQUAL_STRING(
        "org/iotech-demo/device/sensor-floor-1/telemetry", topic);
}

void test_integration_all_standard_topics(void) {
    device_config_t cfg = {
        .tenant_id = "acme",
        .device_id = "unit-007",
    };

    const char *subtopics[] = { "telemetry", "status", "ota/notify", "config" };
    const char *expected[]  = {
        "org/acme/device/unit-007/telemetry",
        "org/acme/device/unit-007/status",
        "org/acme/device/unit-007/ota/notify",
        "org/acme/device/unit-007/config",
    };

    for (int i = 0; i < 4; i++) {
        char buf[256] = {0};
        TEST_ASSERT_EQUAL_INT(ESP_OK,
            provisioning_build_topic(&cfg, subtopics[i], buf, sizeof(buf)));
        TEST_ASSERT_EQUAL_STRING(expected[i], buf);
    }
}

/* -----------------------------------------------------------------------
 * Integration: hardware_id derived at provisioning time
 * --------------------------------------------------------------------- */
void test_integration_hardware_id_from_mac(void) {
    device_config_t cfg = {
        .backend_url = "https://api.example.com",
        .claim_token = "CLAIM-42",
    };

    /* Call register — HTTP fails (mock), but hardware_id is set */
    prov_result_t result = provisioning_client_register(&cfg);
    TEST_ASSERT_EQUAL_INT(PROV_RESULT_ERROR, result);  /* expected: HTTP stub fails */
    TEST_ASSERT_EQUAL_STRING("aabbccddeeff", cfg.hardware_id);
}

/* -----------------------------------------------------------------------
 * Integration: factory reset clears both WiFi and device config
 * --------------------------------------------------------------------- */
void test_integration_factory_reset_clears_all_nvs(void) {
    wifi_creds_t wifi_in  = { .ssid = "SSID", .password = "pass" };
    device_config_t dev_in = {
        .device_token    = "tok",
        .tenant_id       = "t",
        .device_id       = "d",
        .mqtt_broker_url = "mqtts://x",
        .backend_url     = "https://x",
    };

    nvs_store_credentials(&wifi_in);
    nvs_store_device_config(&dev_in);

    /* Factory reset */
    TEST_ASSERT_EQUAL_INT(ESP_OK, nvs_storage_erase_all());

    /* Both must be gone */
    wifi_creds_t  wifi_out = {0};
    device_config_t dev_out = {0};
    TEST_ASSERT_EQUAL_INT(ESP_ERR_NVS_NOT_FOUND, nvs_load_credentials(&wifi_out));
    TEST_ASSERT_EQUAL_INT(ESP_ERR_NVS_NOT_FOUND, nvs_load_device_config(&dev_out));
}

/* -----------------------------------------------------------------------
 * Integration: re-provision after erase
 * --------------------------------------------------------------------- */
void test_integration_reprovision_after_erase(void) {
    /* First provision */
    device_config_t first = {
        .device_token    = "token-v1",
        .tenant_id       = "org-a",
        .device_id       = "dev-a",
        .mqtt_broker_url = "mqtts://broker-a",
        .backend_url     = "https://backend-a",
    };
    nvs_store_device_config(&first);

    /* Erase and store new config */
    nvs_storage_erase_all();

    device_config_t second = {
        .device_token    = "token-v2",
        .tenant_id       = "org-b",
        .device_id       = "dev-b",
        .mqtt_broker_url = "mqtts://broker-b",
        .backend_url     = "https://backend-b",
    };
    nvs_store_device_config(&second);

    device_config_t out = {0};
    TEST_ASSERT_EQUAL_INT(ESP_OK, nvs_load_device_config(&out));
    TEST_ASSERT_EQUAL_STRING("token-v2",       out.device_token);
    TEST_ASSERT_EQUAL_STRING("org-b",          out.tenant_id);
    TEST_ASSERT_EQUAL_STRING("dev-b",          out.device_id);
    TEST_ASSERT_EQUAL_STRING("mqtts://broker-b", out.mqtt_broker_url);
}

/* -----------------------------------------------------------------------
 * Runner
 * --------------------------------------------------------------------- */
int main(void) {
    UNITY_BEGIN();

    RUN_TEST(test_integration_store_and_load_wifi_creds);
    RUN_TEST(test_integration_device_config_to_mqtt_topic);
    RUN_TEST(test_integration_all_standard_topics);
    RUN_TEST(test_integration_hardware_id_from_mac);
    RUN_TEST(test_integration_factory_reset_clears_all_nvs);
    RUN_TEST(test_integration_reprovision_after_erase);

    return UNITY_END();
}
