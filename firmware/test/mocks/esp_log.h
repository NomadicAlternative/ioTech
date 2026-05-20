/**
 * esp_log.h — mock stub for native testing.
 *
 * ESP-IDF components include "esp_log.h" for logging macros.
 * This stub provides them via esp_idf_mock.h.
 */
#pragma once

#ifdef MOCK_ESP_IDF
#include "esp_idf_mock.h"
#else
#include <stdio.h>
#define ESP_LOGI(tag, fmt, ...) printf("[I][%s] " fmt "\n", tag, ##__VA_ARGS__)
#define ESP_LOGW(tag, fmt, ...) printf("[W][%s] " fmt "\n", tag, ##__VA_ARGS__)
#define ESP_LOGE(tag, fmt, ...) printf("[E][%s] " fmt "\n", tag, ##__VA_ARGS__)
#define ESP_LOGD(tag, fmt, ...) do {} while(0)
#endif
