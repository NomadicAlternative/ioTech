/**
 * @file test_ota_version.c
 * @brief Unit tests for OTA semantic version comparison logic.
 *
 * Tests ota_semver_compare(current, latest):
 *   Returns  1 if latest > current  (upgrade available)
 *   Returns  0 if equal             (no update needed)
 *   Returns -1 if latest < current  (downgrade — skip)
 *
 * This is a pure function — no FreeRTOS, no HTTP, no ESP-IDF needed.
 */

#include "../../mocks/esp_idf_mock.h"

/* Stub asm cert symbols before including ota_manager.c */
const char isrg_root_x1_pem_start[] = "MOCK_CERT_PEM";
const char isrg_root_x1_pem_end[]   = "";

/* Stub headers pulled in by ota_manager.c */
#define esp_https_ota_h
#define esp_ota_ops_h
#define esp_http_client_h

#include "../../components/nvs_storage/include/nvs_storage.h"
#include "../../components/ota_manager/include/ota_manager.h"
#include "../../components/ota_manager/ota_manager.c"

#include <unity.h>

/* -----------------------------------------------------------------------
 * setUp / tearDown
 * --------------------------------------------------------------------- */
void setUp(void)    {}
void tearDown(void) {}

/* -----------------------------------------------------------------------
 * Equal versions → 0
 * --------------------------------------------------------------------- */
void test_equal_versions_returns_zero(void) {
    TEST_ASSERT_EQUAL_INT(0, ota_semver_compare("1.0.0", "1.0.0"));
    TEST_ASSERT_EQUAL_INT(0, ota_semver_compare("0.0.0", "0.0.0"));
    TEST_ASSERT_EQUAL_INT(0, ota_semver_compare("2.14.99", "2.14.99"));
}

/* -----------------------------------------------------------------------
 * Latest > Current (upgrade) → +1
 * --------------------------------------------------------------------- */
void test_major_upgrade_returns_1(void) {
    TEST_ASSERT_EQUAL_INT(1, ota_semver_compare("1.0.0", "2.0.0"));
    TEST_ASSERT_EQUAL_INT(1, ota_semver_compare("0.9.9", "1.0.0"));
}

void test_minor_upgrade_returns_1(void) {
    TEST_ASSERT_EQUAL_INT(1, ota_semver_compare("1.2.3", "1.3.0"));
    TEST_ASSERT_EQUAL_INT(1, ota_semver_compare("1.0.0", "1.1.0"));
}

void test_patch_upgrade_returns_1(void) {
    TEST_ASSERT_EQUAL_INT(1, ota_semver_compare("1.2.3", "1.2.4"));
    TEST_ASSERT_EQUAL_INT(1, ota_semver_compare("1.0.0", "1.0.1"));
}

void test_major_takes_priority_over_minor(void) {
    /* major wins — 2.0.0 > 1.99.99 */
    TEST_ASSERT_EQUAL_INT(1, ota_semver_compare("1.99.99", "2.0.0"));
}

void test_major_takes_priority_over_patch(void) {
    TEST_ASSERT_EQUAL_INT(1, ota_semver_compare("1.0.99", "2.0.0"));
}

/* -----------------------------------------------------------------------
 * Latest < Current (downgrade) → -1
 * --------------------------------------------------------------------- */
void test_major_downgrade_returns_minus1(void) {
    TEST_ASSERT_EQUAL_INT(-1, ota_semver_compare("2.0.0", "1.0.0"));
}

void test_minor_downgrade_returns_minus1(void) {
    TEST_ASSERT_EQUAL_INT(-1, ota_semver_compare("1.3.0", "1.2.0"));
}

void test_patch_downgrade_returns_minus1(void) {
    TEST_ASSERT_EQUAL_INT(-1, ota_semver_compare("1.2.4", "1.2.3"));
}

/* -----------------------------------------------------------------------
 * Edge cases
 * --------------------------------------------------------------------- */
void test_null_current_returns_zero(void) {
    TEST_ASSERT_EQUAL_INT(0, ota_semver_compare(NULL, "1.0.0"));
}

void test_null_latest_returns_zero(void) {
    TEST_ASSERT_EQUAL_INT(0, ota_semver_compare("1.0.0", NULL));
}

void test_both_null_returns_zero(void) {
    TEST_ASSERT_EQUAL_INT(0, ota_semver_compare(NULL, NULL));
}

void test_version_zero(void) {
    TEST_ASSERT_EQUAL_INT(1, ota_semver_compare("0.0.0", "0.0.1"));
    TEST_ASSERT_EQUAL_INT(0, ota_semver_compare("0.0.0", "0.0.0"));
}

void test_large_version_numbers(void) {
    TEST_ASSERT_EQUAL_INT(1,  ota_semver_compare("99.99.98", "99.99.99"));
    TEST_ASSERT_EQUAL_INT(-1, ota_semver_compare("100.0.0",  "99.99.99"));
}

/* -----------------------------------------------------------------------
 * ota_manager_set_url / round-trip sanity
 * --------------------------------------------------------------------- */
void test_set_url_does_not_crash(void) {
    /* Smoke test — just verify no segfault */
    ota_manager_set_url("https://firmware.example.com/v2.0.0/fw.bin");
    ota_manager_set_url(NULL);   /* should be a no-op */
    TEST_PASS();
}

/* -----------------------------------------------------------------------
 * Runner
 * --------------------------------------------------------------------- */
int main(void) {
    UNITY_BEGIN();

    RUN_TEST(test_equal_versions_returns_zero);
    RUN_TEST(test_major_upgrade_returns_1);
    RUN_TEST(test_minor_upgrade_returns_1);
    RUN_TEST(test_patch_upgrade_returns_1);
    RUN_TEST(test_major_takes_priority_over_minor);
    RUN_TEST(test_major_takes_priority_over_patch);
    RUN_TEST(test_major_downgrade_returns_minus1);
    RUN_TEST(test_minor_downgrade_returns_minus1);
    RUN_TEST(test_patch_downgrade_returns_minus1);
    RUN_TEST(test_null_current_returns_zero);
    RUN_TEST(test_null_latest_returns_zero);
    RUN_TEST(test_both_null_returns_zero);
    RUN_TEST(test_version_zero);
    RUN_TEST(test_large_version_numbers);
    RUN_TEST(test_set_url_does_not_crash);

    return UNITY_END();
}
