idf_component_register(
    SRCS "drv_relay.c"
    INCLUDE_DIRS "include"
    REQUIRES io_driver
        io_driver_pal
        json
)
