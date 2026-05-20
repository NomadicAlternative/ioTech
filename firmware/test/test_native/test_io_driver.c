/**
 * @file test_io_driver.c
 * @brief Native unit tests for io_driver engine — registry, load, dispatch.
 */
#include "esp_idf_mock.h"
#include "io_driver_types.h"
#include "io_driver.h"
#include "../../components/io_driver/io_driver.c"

#include <unity.h>
#include <string.h>

/* ── Mock driver instances (static for valid pointers across tests) ─── */
static driver_t mock_dht_drv = {0};
static driver_t mock_relay_drv = {0};

static drv_err_t mock_init(const driver_config_t *cfg) { (void)cfg; return DRV_OK; }
static drv_err_t mock_deinit(void) { return DRV_OK; }

static drv_err_t mock_command(const char *action, const void *arg) {
    (void)action; (void)arg; return DRV_OK;
}

static drv_err_t mock_read(driver_value_t *values, uint8_t *count) {
    if (values && count) { *count = 0; }
    return DRV_OK;
}

void setUp(void) {
    memset(&mock_dht_drv, 0, sizeof(mock_dht_drv));
    memset(&mock_relay_drv, 0, sizeof(mock_relay_drv));
    io_driver_init();
}

void tearDown(void) {}

/* ── Tests ─────────────────────────────────────────────────────────── */

void test_register_one_driver(void) {
    mock_dht_drv.name = "dht22";
    mock_dht_drv.init = mock_init;
    mock_dht_drv.deinit = mock_deinit;
    drv_err_t err = io_driver_register(&mock_dht_drv);
    TEST_ASSERT_EQUAL(DRV_OK, err);
}

void test_register_duplicate_rejected(void) {
    mock_relay_drv.name = "relay";
    io_driver_register(&mock_relay_drv);
    drv_err_t err = io_driver_register(&mock_relay_drv);
    TEST_ASSERT_EQUAL(DRV_ERR_STATE, err);
}

void test_load_driver_success(void) {
    mock_dht_drv.name = "dht22";
    mock_dht_drv.init = mock_init;
    mock_dht_drv.read = mock_read;
    mock_dht_drv.deinit = mock_deinit;
    io_driver_register(&mock_dht_drv);

    driver_config_t cfg = { .gpio = 32 };
    drv_err_t err = io_driver_load("dht22", &cfg);
    TEST_ASSERT_EQUAL(DRV_OK, err);
}

void test_load_unknown_driver(void) {
    driver_config_t cfg = { .gpio = 0 };
    drv_err_t err = io_driver_load("nonexistent", &cfg);
    TEST_ASSERT_EQUAL(DRV_ERR_NOT_FOUND, err);
}

void test_dispatch_to_loaded_driver(void) {
    mock_relay_drv.name = "relay";
    mock_relay_drv.init = mock_init;
    mock_relay_drv.command = mock_command;
    mock_relay_drv.deinit = mock_deinit;
    io_driver_register(&mock_relay_drv);

    driver_config_t cfg = { .gpio = 23, .channels = 1 };
    io_driver_load("relay", &cfg);

    drv_err_t err = io_driver_dispatch_command("relay", NULL);
    TEST_ASSERT_EQUAL(DRV_OK, err);
}

void test_dispatch_unknown_driver(void) {
    drv_err_t err = io_driver_dispatch_command("nonexistent", NULL);
    TEST_ASSERT_EQUAL(DRV_ERR_NOT_FOUND, err);
}

void test_null_args_rejected(void) {
    drv_err_t err = io_driver_register(NULL);
    TEST_ASSERT_EQUAL(DRV_ERR_ARG, err);

    err = io_driver_load(NULL, NULL);
    TEST_ASSERT_EQUAL(DRV_ERR_ARG, err);
}

int main(void) {
    UNITY_BEGIN();
    RUN_TEST(test_register_one_driver);
    RUN_TEST(test_register_duplicate_rejected);
    RUN_TEST(test_load_driver_success);
    RUN_TEST(test_load_unknown_driver);
    RUN_TEST(test_dispatch_to_loaded_driver);
    RUN_TEST(test_dispatch_unknown_driver);
    RUN_TEST(test_null_args_rejected);
    return UNITY_END();
}
