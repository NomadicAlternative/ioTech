idf_component_register(
    SRCS
        driver_dht22.c
        driver_bme280.c
        driver_ds18b20.c
        driver_pir.c
        driver_hcsr04.c
    INCLUDE_DIRS "include"
    REQUIRES driver cjson
)
