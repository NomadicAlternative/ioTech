idf_component_register(
    SRCS "io_driver.c" "io_driver_nvs.c"
    INCLUDE_DIRS "include"
    REQUIRES
        io_board
        nvs_flash
        json
        freertos
)
