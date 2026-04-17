/**
 * @file test_nvs_parser.c
 * @brief Unit tests for nvs_storage store/load/erase functions.
 *
 * Includes nvs_storage.c directly so we compile and exercise the real
 * implementation against the in-memory NVS mock.
 */

/* ---- include order matters: mock FIRST, then source ---- */
#include "../../mocks/esp_idf_mock.h"

/* Redirect ESP-IDF headers to the mock */
#define esp_log_h
#define nvs_flash_h
#define nvs_h

#include "../../components/nvs_storage/include/nvs_storage.h"
#include "../../components/nvs_storage/nvs_storage.c"

#include <unity.h>

/* -----------------------------------------------------------------------
 * setUp / tearDown — reset mock NVS before every test
 * --------------------------------------------------------------------- */
void setUp(void)    { mock_nvs_reset(); }
void tearDown(void) {}

/* -----------------------------------------------------------------------
 * WiFi credentials
 * --------------------------------------------------------------------- */
void test_store_and_load_wifi_creds(void) {
    wifi_creds_t in  = { .ssid = "MySSID", .password = "S3cr3t!" };
    wifi_creds_t out = {0};

    TEST_ASSERT_EQUAL_INT(ESP_OK, nvs_store_credentials(&in));
    TEST_ASSERT_EQUAL_INT(ESP_OK, nvs_load_credentials(&out));
    TEST_ASSERT_EQUAL_STRING("MySSID",  out.ssid);
    TEST_ASSERT_EQUAL_STRING("S3cr3t!", out.password);
}

void test_load_wifi_creds_returns_not_found_when_empty(void) {
    wifi_creds_t out = {0};
    TEST_ASSERT_EQUAL_INT(ESP_ERR_NVS_NOT_FOUND, nvs_load_credentials(&out));
}

void test_store_wifi_creds_null_returns_invalid_arg(void) {
    TEST_ASSERT_EQUAL_INT(ESP_ERR_INVALID_ARG, nvs_store_credentials(NULL));
}

void test_load_wifi_creds_null_returns_invalid_arg(void) {
    TEST_ASSERT_EQUAL_INT(ESP_ERR_INVALID_ARG, nvs_load_credentials(NULL));
}

void test_overwrite_wifi_creds(void) {
    wifi_creds_t first  = { .ssid = "OldNet",  .password = "OldPass" };
    wifi_creds_t second = { .ssid = "NewNet",  .password = "NewPass" };
    wifi_creds_t out    = {0};

    TEST_ASSERT_EQUAL_INT(ESP_OK, nvs_store_credentials(&first));
    TEST_ASSERT_EQUAL_INT(ESP_OK, nvs_store_credentials(&second));
    TEST_ASSERT_EQUAL_INT(ESP_OK, nvs_load_credentials(&out));
    TEST_ASSERT_EQUAL_STRING("NewNet",  out.ssid);
    TEST_ASSERT_EQUAL_STRING("NewPass", out.password);
}

/* -----------------------------------------------------------------------
 * Device config
 * --------------------------------------------------------------------- */
void test_store_and_load_device_config(void) {
    device_config_t in = {
        .device_token    = "tok-abc123",
        .tenant_id       = "tenant-42",
        .device_id       = "dev-0001",
        .mqtt_broker_url = "mqtts://broker.iotech.io",
        .backend_url     = "https://api.iotech.io",
        .hardware_id     = "aabbccddeeff",
    };
    device_config_t out = {0};

    TEST_ASSERT_EQUAL_INT(ESP_OK, nvs_store_device_config(&in));
    TEST_ASSERT_EQUAL_INT(ESP_OK, nvs_load_device_config(&out));
    TEST_ASSERT_EQUAL_STRING("tok-abc123",              out.device_token);
    TEST_ASSERT_EQUAL_STRING("tenant-42",               out.tenant_id);
    TEST_ASSERT_EQUAL_STRING("dev-0001",                out.device_id);
    TEST_ASSERT_EQUAL_STRING("mqtts://broker.iotech.io",out.mqtt_broker_url);
    TEST_ASSERT_EQUAL_STRING("https://api.iotech.io",   out.backend_url);
    TEST_ASSERT_EQUAL_STRING("aabbccddeeff",            out.hardware_id);
}

void test_load_device_config_returns_not_found_when_empty(void) {
    device_config_t out = {0};
    TEST_ASSERT_EQUAL_INT(ESP_ERR_NVS_NOT_FOUND, nvs_load_device_config(&out));
}

void test_store_device_config_null_returns_invalid_arg(void) {
    TEST_ASSERT_EQUAL_INT(ESP_ERR_INVALID_ARG, nvs_store_device_config(NULL));
}

void test_load_device_config_null_returns_invalid_arg(void) {
    TEST_ASSERT_EQUAL_INT(ESP_ERR_INVALID_ARG, nvs_load_device_config(NULL));
}

void test_optional_claim_token_stored_and_loaded(void) {
    device_config_t in = {
        .device_token    = "tok",
        .tenant_id       = "t1",
        .device_id       = "d1",
        .mqtt_broker_url = "mqtts://x",
        .backend_url     = "https://x",
        .claim_token     = "CLAIM-XYZ",
    };
    device_config_t out = {0};

    nvs_store_device_config(&in);
    nvs_load_device_config(&out);
    TEST_ASSERT_EQUAL_STRING("CLAIM-XYZ", out.claim_token);
}

void test_empty_claim_token_not_written(void) {
    /* claim_token[0] == '\0' → NVS write is skipped */
    device_config_t in = {
        .device_token    = "tok",
        .tenant_id       = "t1",
        .device_id       = "d1",
        .mqtt_broker_url = "mqtts://x",
        .backend_url     = "https://x",
        .claim_token     = "",  /* explicitly empty */
    };
    device_config_t out = {0};

    nvs_store_device_config(&in);
    nvs_load_device_config(&out);
    /* claim_token should be empty in output (key was never written) */
    TEST_ASSERT_EQUAL_STRING("", out.claim_token);
}

/* -----------------------------------------------------------------------
 * Erase
 * --------------------------------------------------------------------- */
void test_erase_all_removes_stored_credentials(void) {
    wifi_creds_t in  = { .ssid = "SSID", .password = "pass" };
    wifi_creds_t out = {0};

    nvs_store_credentials(&in);
    TEST_ASSERT_EQUAL_INT(ESP_OK, nvs_storage_erase_all());
    TEST_ASSERT_EQUAL_INT(ESP_ERR_NVS_NOT_FOUND, nvs_load_credentials(&out));
}

void test_erase_all_removes_device_config(void) {
    device_config_t in = {
        .device_token    = "tok",
        .tenant_id       = "t1",
        .device_id       = "d1",
        .mqtt_broker_url = "mqtts://x",
        .backend_url     = "https://x",
    };
    device_config_t out = {0};

    nvs_store_device_config(&in);
    TEST_ASSERT_EQUAL_INT(ESP_OK, nvs_storage_erase_all());
    TEST_ASSERT_EQUAL_INT(ESP_ERR_NVS_NOT_FOUND, nvs_load_device_config(&out));
}

/* -----------------------------------------------------------------------
 * Runner
 * --------------------------------------------------------------------- */
int main(void) {
    UNITY_BEGIN();

    RUN_TEST(test_store_and_load_wifi_creds);
    RUN_TEST(test_load_wifi_creds_returns_not_found_when_empty);
    RUN_TEST(test_store_wifi_creds_null_returns_invalid_arg);
    RUN_TEST(test_load_wifi_creds_null_returns_invalid_arg);
    RUN_TEST(test_overwrite_wifi_creds);

    RUN_TEST(test_store_and_load_device_config);
    RUN_TEST(test_load_device_config_returns_not_found_when_empty);
    RUN_TEST(test_store_device_config_null_returns_invalid_arg);
    RUN_TEST(test_load_device_config_null_returns_invalid_arg);
    RUN_TEST(test_optional_claim_token_stored_and_loaded);
    RUN_TEST(test_empty_claim_token_not_written);

    RUN_TEST(test_erase_all_removes_stored_credentials);
    RUN_TEST(test_erase_all_removes_device_config);

    return UNITY_END();
}
