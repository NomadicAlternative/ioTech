/**
 * @file test_provisioning.c
 * @brief Unit tests for provisioning_client pure-logic functions.
 *
 * Tests:
 *   - provisioning_build_topic()  — pure string builder, no network
 *   - hardware_id derivation from MAC (via esp_efuse_mac_get_default stub)
 *
 * The HTTP-based provisioning_client_register() requires a real TLS stack
 * and is covered only in integration/embedded tests.
 */

#include "../../mocks/esp_idf_mock.h"

/* Stub the asm-linked cert symbols before including the source */
const char isrg_root_x1_pem_start[] = "MOCK_CERT_PEM";
const char isrg_root_x1_pem_end[]   = "";

/* Stub headers that provisioning_client.c drags in */
#define esp_log_h
#define esp_http_client_h
#define esp_tls_h
#define cJSON_h
#define esp_efuse_h
#define esp_mac_h

#include "../../components/nvs_storage/include/nvs_storage.h"
#include "../../components/provisioning_client/include/provisioning_client.h"
#include "../../components/provisioning_client/provisioning_client.c"

#include <unity.h>

/* -----------------------------------------------------------------------
 * setUp / tearDown
 * --------------------------------------------------------------------- */
void setUp(void)    { mock_nvs_reset(); }
void tearDown(void) {}

/* -----------------------------------------------------------------------
 * provisioning_build_topic()
 * --------------------------------------------------------------------- */
void test_topic_basic(void) {
    device_config_t cfg = {
        .tenant_id = "tenant-42",
        .device_id = "dev-0001",
    };
    char buf[128] = {0};

    TEST_ASSERT_EQUAL_INT(ESP_OK,
        provisioning_build_topic(&cfg, "telemetry", buf, sizeof(buf)));
    TEST_ASSERT_EQUAL_STRING("org/tenant-42/device/dev-0001/telemetry", buf);
}

void test_topic_status(void) {
    device_config_t cfg = { .tenant_id = "t1", .device_id = "d1" };
    char buf[128] = {0};

    TEST_ASSERT_EQUAL_INT(ESP_OK,
        provisioning_build_topic(&cfg, "status", buf, sizeof(buf)));
    TEST_ASSERT_EQUAL_STRING("org/t1/device/d1/status", buf);
}

void test_topic_ota_notify(void) {
    device_config_t cfg = { .tenant_id = "acme", .device_id = "sensor-01" };
    char buf[128] = {0};

    TEST_ASSERT_EQUAL_INT(ESP_OK,
        provisioning_build_topic(&cfg, "ota/notify", buf, sizeof(buf)));
    TEST_ASSERT_EQUAL_STRING("org/acme/device/sensor-01/ota/notify", buf);
}

void test_topic_config_subtopic(void) {
    device_config_t cfg = { .tenant_id = "corp", .device_id = "node-99" };
    char buf[128] = {0};

    TEST_ASSERT_EQUAL_INT(ESP_OK,
        provisioning_build_topic(&cfg, "config", buf, sizeof(buf)));
    TEST_ASSERT_EQUAL_STRING("org/corp/device/node-99/config", buf);
}

void test_topic_buffer_too_small_returns_invalid_size(void) {
    device_config_t cfg = { .tenant_id = "tenant-42", .device_id = "dev-0001" };
    char tiny[10] = {0};

    esp_err_t err = provisioning_build_topic(&cfg, "telemetry", tiny, sizeof(tiny));
    TEST_ASSERT_EQUAL_INT(ESP_ERR_INVALID_SIZE, err);
}

void test_topic_null_cfg_returns_invalid_arg(void) {
    char buf[128] = {0};
    TEST_ASSERT_EQUAL_INT(ESP_ERR_INVALID_ARG,
        provisioning_build_topic(NULL, "telemetry", buf, sizeof(buf)));
}

void test_topic_null_subtopic_returns_invalid_arg(void) {
    device_config_t cfg = { .tenant_id = "t", .device_id = "d" };
    char buf[128] = {0};
    TEST_ASSERT_EQUAL_INT(ESP_ERR_INVALID_ARG,
        provisioning_build_topic(&cfg, NULL, buf, sizeof(buf)));
}

void test_topic_null_out_returns_invalid_arg(void) {
    device_config_t cfg = { .tenant_id = "t", .device_id = "d" };
    TEST_ASSERT_EQUAL_INT(ESP_ERR_INVALID_ARG,
        provisioning_build_topic(&cfg, "telemetry", NULL, 128));
}

void test_topic_empty_subtopic(void) {
    device_config_t cfg = { .tenant_id = "t", .device_id = "d" };
    char buf[64] = {0};

    TEST_ASSERT_EQUAL_INT(ESP_OK,
        provisioning_build_topic(&cfg, "", buf, sizeof(buf)));
    TEST_ASSERT_EQUAL_STRING("org/t/device/d/", buf);
}

/* -----------------------------------------------------------------------
 * hardware_id derivation from MAC
 * The mock returns AA:BB:CC:DD:EE:FF → expected id: "aabbccddeeff"
 * --------------------------------------------------------------------- */
void test_hardware_id_derived_from_mac(void) {
    device_config_t cfg = {
        .backend_url = "https://api.example.com",
        .claim_token = "CLAIM-001",
    };

    /* provisioning_client_register() fills hardware_id then tries HTTP.
       With our stub, HTTP returns ESP_FAIL so result is PROV_RESULT_ERROR.
       But hardware_id IS populated before the first HTTP attempt. */
    provisioning_client_register(&cfg);

    TEST_ASSERT_EQUAL_STRING("aabbccddeeff", cfg.hardware_id);
}

/* -----------------------------------------------------------------------
 * Runner
 * --------------------------------------------------------------------- */
int main(void) {
    UNITY_BEGIN();

    RUN_TEST(test_topic_basic);
    RUN_TEST(test_topic_status);
    RUN_TEST(test_topic_ota_notify);
    RUN_TEST(test_topic_config_subtopic);
    RUN_TEST(test_topic_buffer_too_small_returns_invalid_size);
    RUN_TEST(test_topic_null_cfg_returns_invalid_arg);
    RUN_TEST(test_topic_null_subtopic_returns_invalid_arg);
    RUN_TEST(test_topic_null_out_returns_invalid_arg);
    RUN_TEST(test_topic_empty_subtopic);
    RUN_TEST(test_hardware_id_derived_from_mac);

    return UNITY_END();
}
