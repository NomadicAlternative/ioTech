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

/* ── FW01: DRV_FLAG_MULTI_INSTANCE ────────────────────────────────── */

void test_flag_multi_instance_defined(void) {
    TEST_ASSERT_EQUAL(0x01, DRV_FLAG_MULTI_INSTANCE);
}

void test_driver_flags_field_zero_by_default(void) {
    driver_t drv = {0};
    TEST_ASSERT_EQUAL(0, drv.flags);
}

void test_driver_flags_settable(void) {
    driver_t drv = {0};
    drv.flags = DRV_FLAG_MULTI_INSTANCE;
    TEST_ASSERT_EQUAL(DRV_FLAG_MULTI_INSTANCE, drv.flags);
}

/* ── FW02: Multi-instance loading ─────────────────────────────────── */

static driver_t mock_multi_drv = {0};
static int mock_multi_init_count = 0;

static drv_err_t mock_multi_init(const driver_config_t *cfg) {
    (void)cfg;
    mock_multi_init_count++;
    return DRV_OK;
}

void test_multi_instance_load_twice_ok(void) {
    mock_multi_drv.name = "relay";
    mock_multi_drv.flags = DRV_FLAG_MULTI_INSTANCE;
    mock_multi_drv.init = mock_multi_init;
    mock_multi_drv.deinit = mock_deinit;
    io_driver_register(&mock_multi_drv);

    mock_multi_init_count = 0;
    driver_config_t cfg1 = { .gpio = 23, .channels = 1 };
    driver_config_t cfg2 = { .gpio = 22, .channels = 1 };

    drv_err_t err1 = io_driver_load("relay", &cfg1);
    TEST_ASSERT_EQUAL(DRV_OK, err1);
    TEST_ASSERT_EQUAL(1, mock_multi_init_count);

    drv_err_t err2 = io_driver_load("relay", &cfg2);
    TEST_ASSERT_EQUAL(DRV_OK, err2);
    TEST_ASSERT_EQUAL(2, mock_multi_init_count); /* init called twice */
}

void test_single_instance_load_twice_noop(void) {
    mock_dht_drv.name = "dht22";
    mock_dht_drv.flags = 0; /* single-instance, default */
    mock_dht_drv.init = mock_init;
    mock_dht_drv.deinit = mock_deinit;
    io_driver_register(&mock_dht_drv);

    driver_config_t cfg1 = { .gpio = 32 };
    driver_config_t cfg2 = { .gpio = 33 };

    drv_err_t err1 = io_driver_load("dht22", &cfg1);
    TEST_ASSERT_EQUAL(DRV_OK, err1);

    /* Single-instance: second load with different GPIO should still succeed
       but the existing entry is kept — init not called again */
    drv_err_t err2 = io_driver_load("dht22", &cfg2);
    TEST_ASSERT_EQUAL(DRV_OK, err2);
    TEST_ASSERT_EQUAL(1, io_driver_active_count()); /* still one active */
}

void test_multi_instance_dispatch_by_gpio(void) {
    /* Load multi-instance driver, then dispatch by disambiguated name */
    mock_multi_drv.name = "relay";
    mock_multi_drv.flags = DRV_FLAG_MULTI_INSTANCE;
    mock_multi_drv.init = mock_multi_init;
    mock_multi_drv.command = mock_command;
    mock_multi_drv.deinit = mock_deinit;
    io_driver_register(&mock_multi_drv);

    driver_config_t cfg23 = { .gpio = 23, .channels = 1 };
    driver_config_t cfg22 = { .gpio = 22, .channels = 1 };
    io_driver_load("relay", &cfg23);
    io_driver_load("relay", &cfg22);

    drv_err_t err23 = io_driver_dispatch_command("RELAY_23", NULL);
    TEST_ASSERT_EQUAL(DRV_OK, err23);
    drv_err_t err22 = io_driver_dispatch_command("RELAY_22", NULL);
    TEST_ASSERT_EQUAL(DRV_OK, err22);
}

/* ── FW04: io_driver_read_by_name ─────────────────────────────────── */

static drv_err_t mock_read_temp(driver_value_t *values, uint8_t *count) {
    if (values && count) {
        values[0].type = DRV_VAL_NUMBER;
        values[0].number_value = 25.5;
        strncpy(values[0].key, "temperature", sizeof(values[0].key));
        *count = 1;
    }
    return DRV_OK;
}

void test_read_by_name_found(void) {
    /* Register + load DHT22 with mock read that returns temperature */
    mock_dht_drv.name = "dht22";
    mock_dht_drv.flags = 0;
    mock_dht_drv.init = mock_init;
    mock_dht_drv.read = mock_read_temp;
    mock_dht_drv.deinit = mock_deinit;
    io_driver_register(&mock_dht_drv);

    driver_config_t cfg = { .gpio = 32 };
    io_driver_load("dht22", &cfg);

    driver_value_t values[DRV_MAX_VALUES];
    uint8_t count = 0;
    drv_err_t err = io_driver_read_by_name("dht22", values, &count);
    TEST_ASSERT_EQUAL(DRV_OK, err);
    TEST_ASSERT_EQUAL(1, count);
    TEST_ASSERT_EQUAL(25.5, values[0].number_value);
    TEST_ASSERT_EQUAL_STRING("temperature", values[0].key);
}

void test_read_by_name_not_found(void) {
    driver_value_t values[DRV_MAX_VALUES];
    uint8_t count = 0;
    drv_err_t err = io_driver_read_by_name("nonexistent", values, &count);
    TEST_ASSERT_EQUAL(DRV_ERR_NOT_FOUND, err);
}

void test_read_by_name_case_insensitive(void) {
    /* Register + load DHT22 and then query with "DHT22" (uppercase) */
    mock_dht_drv.name = "dht22";
    mock_dht_drv.flags = 0;
    mock_dht_drv.init = mock_init;
    mock_dht_drv.read = mock_read_temp;
    mock_dht_drv.deinit = mock_deinit;
    io_driver_register(&mock_dht_drv);

    driver_config_t cfg = { .gpio = 32 };
    io_driver_load("dht22", &cfg);

    driver_value_t values[DRV_MAX_VALUES];
    uint8_t count = 0;
    drv_err_t err = io_driver_read_by_name("DHT22", values, &count);
    TEST_ASSERT_EQUAL(DRV_OK, err);
    TEST_ASSERT_EQUAL(1, count);
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
    /* FW01 */
    RUN_TEST(test_flag_multi_instance_defined);
    RUN_TEST(test_driver_flags_field_zero_by_default);
    RUN_TEST(test_driver_flags_settable);
    /* FW02 */
    RUN_TEST(test_multi_instance_load_twice_ok);
    RUN_TEST(test_single_instance_load_twice_noop);
    RUN_TEST(test_multi_instance_dispatch_by_gpio);
    /* FW04 */
    RUN_TEST(test_read_by_name_found);
    RUN_TEST(test_read_by_name_not_found);
    RUN_TEST(test_read_by_name_case_insensitive);
    return UNITY_END();
}
