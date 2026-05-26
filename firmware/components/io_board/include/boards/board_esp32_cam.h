/**
 * @file board_esp32_cam.h
 * @brief ESP32-CAM (AI-Thinker) — pin assignments for ioTech driver board.
 *
 * Highly constrained: SD card, camera, PSRAM consume most pins.
 * Avoid flash/PSRAM/camera pins: 0, 2, 12, 15, 16, 17.
 * Only DHT22, I2C, and relay drivers are viable.
 * Other drivers set to DRV_GPIO_NONE (0xFF) — no pins available.
 */
#pragma once

#define BOARD_DHT_GPIO       33
#define BOARD_I2C_SDA        13
#define BOARD_I2C_SCL        12
#define BOARD_RELAY1_GPIO    2
#define BOARD_RELAY2_GPIO    14
#define BOARD_RELAY3_GPIO    15
#define BOARD_RELAY4_GPIO    4
#define BOARD_RELAY5_GPIO    16
#define BOARD_RELAY6_GPIO    3
#define BOARD_RELAY7_GPIO    1
#define BOARD_RELAY8_GPIO    0xFF  /* No pin available */
#define BOARD_WS2812_GPIO    0xFF  /* No RMT spare on CAM */
#define BOARD_SERVO_GPIO     0xFF  /* No pin available */
#define BOARD_PIR_GPIO       0xFF  /* No pin available */
#define BOARD_HCSR04_TRIG    0xFF  /* No pin available */
#define BOARD_HCSR04_ECHO    0xFF  /* No pin available */
#define BOARD_ONEWIRE_GPIO   0xFF  /* No pin available */
#define BOARD_BUZZER_GPIO    0xFF  /* No pin available */

/* Board peripheral constants */
#define BOARD_LEDC_TIMER_BIT  LEDC_TIMER_16_BIT
#define BOARD_UART_NUM        2
