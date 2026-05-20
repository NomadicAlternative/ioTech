/**
 * @file board_esp32_c3.h
 * @brief ESP32-C3 — pin assignments for ioTech driver board.
 *
 * Avoid strapping: GPIO 2, 8, 9.
 * Note: C3 has no RMT RX — HC-SR04 echo uses timer fallback.
 *       Set BOARD_HCSR04_ECHO to DRV_GPIO_NONE (0xFF) to signal this.
 */
#pragma once

#define BOARD_DHT_GPIO       0
#define BOARD_I2C_SDA        3
#define BOARD_I2C_SCL        4
#define BOARD_RELAY1_GPIO    10
#define BOARD_RELAY2_GPIO    6
#define BOARD_RELAY3_GPIO    7
#define BOARD_RELAY4_GPIO    5
#define BOARD_RELAY5_GPIO    20
#define BOARD_RELAY6_GPIO    21
#define BOARD_RELAY7_GPIO    19
#define BOARD_RELAY8_GPIO    18
#define BOARD_WS2812_GPIO    8
#define BOARD_SERVO_GPIO     9
#define BOARD_PIR_GPIO       1
#define BOARD_HCSR04_TRIG    2
/* C3 has no RMT RX — set echo to NONE (use timer fallback) */
#define BOARD_HCSR04_ECHO    0xFF
#define BOARD_ONEWIRE_GPIO   0xFF  /* Not available */
#define BOARD_BUZZER_GPIO    0xFF  /* Not available */
