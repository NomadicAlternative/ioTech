/**
 * @file board_esp32_s3.h
 * @brief ESP32-S3 — pin assignments for ioTech driver board.
 *
 * Avoid strapping: GPIO 0, 3, 45, 46.
 */
#pragma once

#define BOARD_DHT_GPIO       4
#define BOARD_I2C_SDA        1
#define BOARD_I2C_SCL        2
#define BOARD_RELAY1_GPIO    5
#define BOARD_RELAY2_GPIO    6
#define BOARD_RELAY3_GPIO    7
#define BOARD_RELAY4_GPIO    15
#define BOARD_RELAY5_GPIO    16
#define BOARD_RELAY6_GPIO    17
#define BOARD_RELAY7_GPIO    18
#define BOARD_RELAY8_GPIO    8
#define BOARD_WS2812_GPIO    48
#define BOARD_SERVO_GPIO     9
#define BOARD_PIR_GPIO       10
#define BOARD_HCSR04_TRIG    11
#define BOARD_HCSR04_ECHO    12
#define BOARD_ONEWIRE_GPIO   13
#define BOARD_BUZZER_GPIO    14
