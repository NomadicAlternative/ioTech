/**
 * @file board_esp32_devkit.h
 * @brief ESP32 DevKit V1 — pin assignments for ioTech driver board.
 *
 * Strapping pins avoided: GPIO 0, 2, 12 (MTDI), 15 (MTDO).
 * Flash pins GPIO 6–11 are reserved by ESP32.
 */
#pragma once

#define BOARD_DHT_GPIO       32
#define BOARD_I2C_SDA        21
#define BOARD_I2C_SCL        22
/* Relays 1–8 → GPIOs (matching current relay_controller.c for 1-7) */
#define BOARD_RELAY1_GPIO    23
#define BOARD_RELAY2_GPIO    22
#define BOARD_RELAY3_GPIO    21
#define BOARD_RELAY4_GPIO    19
#define BOARD_RELAY5_GPIO    18
#define BOARD_RELAY6_GPIO    5
#define BOARD_RELAY7_GPIO    17
#define BOARD_RELAY8_GPIO    16   /* Note: 16 may conflict with PSRAM on some boards;
                                     OK on DevKit V1 (no PSRAM) */
#define BOARD_WS2812_GPIO    25
#define BOARD_SERVO_GPIO     26
#define BOARD_PIR_GPIO       27
#define BOARD_HCSR04_TRIG    33
#define BOARD_HCSR04_ECHO    34   /* GPIO 34–39 are input-only */
#define BOARD_ONEWIRE_GPIO   4
#define BOARD_BUZZER_GPIO    13

/* Board peripheral constants */
#define BOARD_LEDC_TIMER_BIT  LEDC_TIMER_16_BIT
#define BOARD_UART_NUM        2
