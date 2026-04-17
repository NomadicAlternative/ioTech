/**
 * @file test_mqtt_topics.c
 * @brief Unit tests for MQTT topic string construction.
 *
 * Exercises provisioning_build_topic() with a comprehensive set of
 * tenant/device ID combinations to ensure correct topic patterns.
 * These topics are used by mqtt_manager for pub/sub routing.
 *
 * Pattern: org/{tenant_id}/device/{device_id}/{subtopic}
 */

#include "../../mocks/esp_idf_mock.h"

/* Stub asm cert symbols before pulling in provisioning_client.c */
const char isrg_root_x1_pem_start[] = "MOCK_CERT_PEM";
const char isrg_root_x1_pem_end[]   = "";

#include "../../components/nvs_storage/include/nvs_storage.h"
#include "../../components/provisioning_client/include/provisioning_client.h"
#include "../../components/provisioning_client/provisioning_client.c"

#include <unity.h>
#include <string.h>

/* -----------------------------------------------------------------------
 * setUp / tearDown
 * --------------------------------------------------------------------- */
void setUp(void)    {}
void tearDown(void) {}

/* -----------------------------------------------------------------------
 * Helper macro
 * --------------------------------------------------------------------- */
#define ASSERT_TOPIC(tenant, device, subtopic, expected_str)         \
    do {                                                              \
        device_config_t _cfg = {0};                                  \
        strncpy(_cfg.tenant_id, (tenant), sizeof(_cfg.tenant_id)-1); \
        strncpy(_cfg.device_id, (device), sizeof(_cfg.device_id)-1); \
        char _buf[256] = {0};                                        \
        esp_err_t _r = provisioning_build_topic(&_cfg, (subtopic),   \
                                                _buf, sizeof(_buf)); \
        TEST_ASSERT_EQUAL_INT(ESP_OK, _r);                           \
        TEST_ASSERT_EQUAL_STRING((expected_str), _buf);              \
    } while(0)

/* -----------------------------------------------------------------------
 * Standard sub-topics used by the system
 * --------------------------------------------------------------------- */
void test_topic_telemetry(void) {
    ASSERT_TOPIC("myorg", "dev-001", "telemetry",
                 "org/myorg/device/dev-001/telemetry");
}

void test_topic_status_online(void) {
    ASSERT_TOPIC("myorg", "dev-001", "status",
                 "org/myorg/device/dev-001/status");
}

void test_topic_ota_notify(void) {
    ASSERT_TOPIC("myorg", "dev-001", "ota/notify",
                 "org/myorg/device/dev-001/ota/notify");
}

void test_topic_config(void) {
    ASSERT_TOPIC("myorg", "dev-001", "config",
                 "org/myorg/device/dev-001/config");
}

void test_topic_lwt(void) {
    /* LWT (Last Will and Testament) uses the status topic */
    ASSERT_TOPIC("acme-corp", "sensor-99", "status",
                 "org/acme-corp/device/sensor-99/status");
}

/* -----------------------------------------------------------------------
 * UUIDs and realistic IDs
 * --------------------------------------------------------------------- */
void test_topic_with_uuid_device_id(void) {
    ASSERT_TOPIC(
        "tenant-001",
        "550e8400-e29b-41d4-a716-446655440000",
        "telemetry",
        "org/tenant-001/device/550e8400-e29b-41d4-a716-446655440000/telemetry"
    );
}

void test_topic_with_hyphenated_tenant(void) {
    ASSERT_TOPIC("my-great-org", "device-42", "telemetry",
                 "org/my-great-org/device/device-42/telemetry");
}

/* -----------------------------------------------------------------------
 * Edge cases
 * --------------------------------------------------------------------- */
void test_topic_exact_buffer_fit(void) {
    /* "org/t/device/d/s" = 17 chars + NUL = 18 bytes */
    device_config_t cfg = {0};
    strncpy(cfg.tenant_id, "t", sizeof(cfg.tenant_id) - 1);
    strncpy(cfg.device_id, "d", sizeof(cfg.device_id) - 1);
    char buf[18] = {0};

    TEST_ASSERT_EQUAL_INT(ESP_OK,
        provisioning_build_topic(&cfg, "s", buf, sizeof(buf)));
    TEST_ASSERT_EQUAL_STRING("org/t/device/d/s", buf);
}

void test_topic_one_byte_too_small_returns_invalid_size(void) {
    /* "org/t/device/d/s" = 17 chars + NUL needs 18 — give 17 */
    device_config_t cfg = {0};
    strncpy(cfg.tenant_id, "t", sizeof(cfg.tenant_id) - 1);
    strncpy(cfg.device_id, "d", sizeof(cfg.device_id) - 1);
    char buf[17] = {0};

    TEST_ASSERT_EQUAL_INT(ESP_ERR_INVALID_SIZE,
        provisioning_build_topic(&cfg, "s", buf, sizeof(buf)));
}

void test_topic_nested_subtopic_depth_3(void) {
    ASSERT_TOPIC("org1", "dev1", "a/b/c",
                 "org/org1/device/dev1/a/b/c");
}

/* -----------------------------------------------------------------------
 * Runner
 * --------------------------------------------------------------------- */
int main(void) {
    UNITY_BEGIN();

    RUN_TEST(test_topic_telemetry);
    RUN_TEST(test_topic_status_online);
    RUN_TEST(test_topic_ota_notify);
    RUN_TEST(test_topic_config);
    RUN_TEST(test_topic_lwt);
    RUN_TEST(test_topic_with_uuid_device_id);
    RUN_TEST(test_topic_with_hyphenated_tenant);
    RUN_TEST(test_topic_exact_buffer_fit);
    RUN_TEST(test_topic_one_byte_too_small_returns_invalid_size);
    RUN_TEST(test_topic_nested_subtopic_depth_3);

    return UNITY_END();
}
