idf_component_register(
    SRCS
        driver_relay.c
        driver_ws2812b.c
        driver_servo.c
    INCLUDE_DIRS "include"
    REQUIRES driver cjson
)
