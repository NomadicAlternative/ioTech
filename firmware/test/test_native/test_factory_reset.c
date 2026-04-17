/**
 * @file test_factory_reset.c
 * @brief Unit tests for factory_reset debounce logic.
 *
 * factory_reset_should_trigger() is a pure function:
 *   returns true  when pressed_ms >= threshold_ms
 *   returns false when pressed_ms <  threshold_ms
 *
 * No GPIO, no FreeRTOS tasks — just boolean logic.
 */

#include "../../mocks/esp_idf_mock.h"

#include "../../components/nvs_storage/include/nvs_storage.h"
#include "../../components/factory_reset/include/factory_reset.h"
#include "../../components/factory_reset/factory_reset.c"

#include <unity.h>

/* -----------------------------------------------------------------------
 * setUp / tearDown
 * --------------------------------------------------------------------- */
void setUp(void)    { mock_gpio_level = 1; /* default: released */ }
void tearDown(void) { last_sm_event = SM_EVT_MAX; }

/* -----------------------------------------------------------------------
 * factory_reset_should_trigger — boundary value analysis
 * --------------------------------------------------------------------- */
void test_not_triggered_at_zero(void) {
    TEST_ASSERT_FALSE(factory_reset_should_trigger(0, FACTORY_RESET_HOLD_MS));
}

void test_not_triggered_below_threshold(void) {
    TEST_ASSERT_FALSE(factory_reset_should_trigger(4999, FACTORY_RESET_HOLD_MS));
}

void test_not_triggered_one_ms_below(void) {
    TEST_ASSERT_FALSE(factory_reset_should_trigger(
        FACTORY_RESET_HOLD_MS - 1, FACTORY_RESET_HOLD_MS));
}

void test_triggered_exactly_at_threshold(void) {
    /* Boundary: pressed_ms == threshold_ms → should trigger */
    TEST_ASSERT_TRUE(factory_reset_should_trigger(
        FACTORY_RESET_HOLD_MS, FACTORY_RESET_HOLD_MS));
}

void test_triggered_above_threshold(void) {
    TEST_ASSERT_TRUE(factory_reset_should_trigger(
        FACTORY_RESET_HOLD_MS + 100, FACTORY_RESET_HOLD_MS));
}

void test_triggered_far_above_threshold(void) {
    TEST_ASSERT_TRUE(factory_reset_should_trigger(10000, FACTORY_RESET_HOLD_MS));
}

/* -----------------------------------------------------------------------
 * Custom thresholds
 * --------------------------------------------------------------------- */
void test_custom_threshold_1000ms(void) {
    TEST_ASSERT_FALSE(factory_reset_should_trigger(999,  1000));
    TEST_ASSERT_TRUE (factory_reset_should_trigger(1000, 1000));
    TEST_ASSERT_TRUE (factory_reset_should_trigger(1001, 1000));
}

void test_custom_threshold_zero(void) {
    /* Any press duration should trigger when threshold is 0 */
    TEST_ASSERT_TRUE(factory_reset_should_trigger(0, 0));
    TEST_ASSERT_TRUE(factory_reset_should_trigger(1, 0));
}

/* -----------------------------------------------------------------------
 * Hold constant
 * --------------------------------------------------------------------- */
void test_default_hold_constant_is_5000ms(void) {
    TEST_ASSERT_EQUAL_UINT32(5000, FACTORY_RESET_HOLD_MS);
}

void test_gpio_pin_constant_is_gpio0(void) {
    TEST_ASSERT_EQUAL_INT(0, FACTORY_RESET_GPIO_PIN);
}

/* -----------------------------------------------------------------------
 * Polling debounce simulation
 * --------------------------------------------------------------------- */
void test_debounce_accumulates_hold_correctly(void) {
    const uint32_t poll_ms = 100;
    uint32_t hold_ms = 0;
    bool triggered = false;

    /* Simulate 50 poll intervals of button held (5000ms total) */
    for (int i = 0; i < 50; i++) {
        hold_ms += poll_ms;
        if (factory_reset_should_trigger(hold_ms, FACTORY_RESET_HOLD_MS)) {
            triggered = true;
            break;
        }
    }

    TEST_ASSERT_TRUE(triggered);
    TEST_ASSERT_EQUAL_UINT32(FACTORY_RESET_HOLD_MS, hold_ms);
}

void test_debounce_resets_on_release(void) {
    const uint32_t poll_ms = 100;
    uint32_t hold_ms = 0;

    /* Press for 40 intervals (4000ms) — not enough */
    for (int i = 0; i < 40; i++) {
        hold_ms += poll_ms;
    }
    TEST_ASSERT_FALSE(factory_reset_should_trigger(hold_ms, FACTORY_RESET_HOLD_MS));

    /* Release: reset counter */
    hold_ms = 0;
    TEST_ASSERT_FALSE(factory_reset_should_trigger(hold_ms, FACTORY_RESET_HOLD_MS));
}

void test_short_press_never_triggers(void) {
    /* Short press: 3 x 100ms = 300ms */
    const uint32_t poll_ms = 100;
    uint32_t hold_ms = 0;

    for (int i = 0; i < 3; i++) {
        hold_ms += poll_ms;
        TEST_ASSERT_FALSE(
            factory_reset_should_trigger(hold_ms, FACTORY_RESET_HOLD_MS));
    }
}

/* -----------------------------------------------------------------------
 * Runner
 * --------------------------------------------------------------------- */
int main(void) {
    UNITY_BEGIN();

    RUN_TEST(test_not_triggered_at_zero);
    RUN_TEST(test_not_triggered_below_threshold);
    RUN_TEST(test_not_triggered_one_ms_below);
    RUN_TEST(test_triggered_exactly_at_threshold);
    RUN_TEST(test_triggered_above_threshold);
    RUN_TEST(test_triggered_far_above_threshold);
    RUN_TEST(test_custom_threshold_1000ms);
    RUN_TEST(test_custom_threshold_zero);
    RUN_TEST(test_default_hold_constant_is_5000ms);
    RUN_TEST(test_gpio_pin_constant_is_gpio0);
    RUN_TEST(test_debounce_accumulates_hold_correctly);
    RUN_TEST(test_debounce_resets_on_release);
    RUN_TEST(test_short_press_never_triggers);

    return UNITY_END();
}
