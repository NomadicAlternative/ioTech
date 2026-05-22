/**
 * @file io_board.h
 * @brief Board pin map — compile-time resolved via -DBOARD_* flag.
 */
#pragma once

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define BOARD_RELAY_MAX 8

typedef struct {
    uint8_t dht_gpio;
    uint8_t i2c_sda;
    uint8_t i2c_scl;
    uint8_t relay_gpios[BOARD_RELAY_MAX];
    uint8_t ws2812_gpio;
    uint8_t servo_gpio;
    uint8_t pir_gpio;
    uint8_t hcsr04_trig;
    uint8_t hcsr04_echo;
    uint8_t one_wire_gpio;
    /* Reserved for future expansion: */
    uint8_t spi_mosi;
    uint8_t spi_miso;
    uint8_t spi_sck;
    uint8_t spi_cs;
    uint8_t buzzer_gpio;
} board_pinmap_t;

/** Call once at boot to initialize the static pinmap. */
void io_board_init(void);

/** Return the compile-time resolved pin map for the target board. */
const board_pinmap_t *io_board_get_pinmap(void);

#ifdef __cplusplus
}
#endif
