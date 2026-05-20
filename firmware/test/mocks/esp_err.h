/**
 * esp_err.h — mock stub for native testing.
 *
 * ESP-IDF components include "esp_err.h" directly. This stub provides the
 * esp_err_t type and error codes so native tests compile without the ESP-IDF
 * toolchain. It is picked up by `-I test/mocks` in platformio.ini.
 */
#pragma once

#ifdef MOCK_ESP_IDF
#include "esp_idf_mock.h"

/* Additional error codes needed by io_driver components */
#ifndef ESP_ERR_NOT_FOUND
#define ESP_ERR_NOT_FOUND     (0x104)
#endif
#ifndef ESP_ERR_TIMEOUT
#define ESP_ERR_TIMEOUT       (0x107)
#endif
#ifndef ESP_ERR_NO_MEM
#define ESP_ERR_NO_MEM        (0x101)
#endif
#else
/* Minimal stand-alone definitions for cases where esp_idf_mock.h isn't included first */
#ifdef __cplusplus
extern "C" {
#endif

typedef int esp_err_t;

#define ESP_OK                     (0)
#define ESP_FAIL                   (-1)
#define ESP_ERR_INVALID_ARG        (0x102)
#define ESP_ERR_INVALID_SIZE       (0x103)
#define ESP_ERR_NVS_NOT_FOUND      (0x1100)
#define ESP_ERR_NVS_NO_FREE_PAGES   (0x1101)
#define ESP_ERR_NVS_NEW_VERSION_FOUND (0x1102)
#define ESP_ERR_NOT_FOUND          (0x104)
#define ESP_ERR_NO_MEM             (0x101)
#define ESP_ERR_TIMEOUT            (0x107)

#ifdef __cplusplus
}
#endif
#endif /* MOCK_ESP_IDF */
