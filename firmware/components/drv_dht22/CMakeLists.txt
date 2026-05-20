idf_component_register(
    SRCS "drv_dht22.c"
    INCLUDE_DIRS "include"
    REQUIRES io_driver
        io_driver_pal
        freertos
)
