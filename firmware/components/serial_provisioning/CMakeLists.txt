idf_component_register(
    SRCS "serial_provisioning.c"
    INCLUDE_DIRS "include"
    REQUIRES
        nvs_storage
        driver
        json
)
