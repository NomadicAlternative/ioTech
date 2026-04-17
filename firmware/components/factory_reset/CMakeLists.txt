idf_component_register(
    SRCS "factory_reset.c"
    INCLUDE_DIRS "include"
    REQUIRES
        nvs_storage
        driver
        freertos
)
