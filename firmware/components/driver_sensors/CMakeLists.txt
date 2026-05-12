idf_component_register(
    SRCS "driver_dht22.c"
    INCLUDE_DIRS "include"
    REQUIRES driver cjson driver_interface
)
