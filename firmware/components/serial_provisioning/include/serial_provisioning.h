/**
 * @file serial_provisioning.h
 * @brief Serial (UART) provisioning for ioTech ESP32.
 *
 * Waits up to SERIAL_PROV_TIMEOUT_MS for a JSON payload on UART0.
 * Expected format (single line, terminated with '\n'):
 *
 *   {"wifi_ssid":"...","wifi_password":"...","backend_url":"...","mqtt_url":"...","device_token":"..."}
 *
 * On success: writes wifi_creds_t + device_config_t to NVS and returns true.
 * On timeout or parse error: returns false — caller falls back to captive portal.
 */
#pragma once

#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/** Timeout in milliseconds to wait for serial credentials. */
#define SERIAL_PROV_TIMEOUT_MS 5000

/**
 * @brief Wait for provisioning credentials over UART0.
 *
 * Blocks for up to SERIAL_PROV_TIMEOUT_MS.
 *
 * @return true  — credentials received, parsed, and written to NVS.
 * @return false — timeout or invalid payload; caller should use captive portal.
 */
bool serial_provisioning_receive(void);

#ifdef __cplusplus
}
#endif
