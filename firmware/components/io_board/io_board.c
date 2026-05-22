/**
 * @file io_board.c
 * @brief Board pin map — compile-time resolver via -DBOARD_* flag.
 */
#include "io_board.h"
#include <string.h>

static board_pinmap_t s_pinmap;

#if defined(BOARD_ESP32_DEVKIT)
    #include "boards/board_esp32_devkit.h"
#elif defined(BOARD_ESP32_S3)
    #include "boards/board_esp32_s3.h"
#elif defined(BOARD_ESP32_C3)
    #include "boards/board_esp32_c3.h"
#elif defined(BOARD_ESP32_CAM)
    #include "boards/board_esp32_cam.h"
#else
    #error "No board variant selected. Set -DBOARD_ESP32_DEVKIT (or S3, C3, CAM) in platformio.ini."
#endif

void io_board_init(void)
{
    /* Zero all fields first */
    memset(&s_pinmap, 0, sizeof(s_pinmap));

    /* Populate from board header defines */
    s_pinmap.dht_gpio       = BOARD_DHT_GPIO;
    s_pinmap.i2c_sda        = BOARD_I2C_SDA;
    s_pinmap.i2c_scl        = BOARD_I2C_SCL;
    s_pinmap.ws2812_gpio    = BOARD_WS2812_GPIO;
    s_pinmap.servo_gpio     = BOARD_SERVO_GPIO;
    s_pinmap.pir_gpio       = BOARD_PIR_GPIO;
    s_pinmap.hcsr04_trig    = BOARD_HCSR04_TRIG;
    s_pinmap.hcsr04_echo    = BOARD_HCSR04_ECHO;
    s_pinmap.one_wire_gpio  = BOARD_ONEWIRE_GPIO;
    s_pinmap.buzzer_gpio    = BOARD_BUZZER_GPIO;

    /* Relay array: populate from individual BOARD_RELAYx_GPIO defines */
    s_pinmap.relay_gpios[0] = BOARD_RELAY1_GPIO;
    s_pinmap.relay_gpios[1] = BOARD_RELAY2_GPIO;
    s_pinmap.relay_gpios[2] = BOARD_RELAY3_GPIO;
    s_pinmap.relay_gpios[3] = BOARD_RELAY4_GPIO;
    s_pinmap.relay_gpios[4] = BOARD_RELAY5_GPIO;
    s_pinmap.relay_gpios[5] = BOARD_RELAY6_GPIO;
    s_pinmap.relay_gpios[6] = BOARD_RELAY7_GPIO;
    s_pinmap.relay_gpios[7] = BOARD_RELAY8_GPIO;
}

const board_pinmap_t *io_board_get_pinmap(void)
{
    return &s_pinmap;
}
