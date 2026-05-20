idf_component_register(
    SRCS "src/pal_gpio.c"
         "src/pal_i2c.c"
         "src/pal_delay.c"
         "src/pal_rmt.c"
         "src/pal_timer.c"
    INCLUDE_DIRS "include"
    REQUIRES
        driver
        esp_timer
        freertos
)
