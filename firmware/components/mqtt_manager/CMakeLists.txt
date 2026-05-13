idf_component_register(
    SRCS "mqtt_manager.c"
    INCLUDE_DIRS "include"
    REQUIRES
        sm_events
        nvs_storage
        mqtt
        esp-tls
        freertos
        relay_controller
        json
        ota_manager
        driver
    EMBED_TXTFILES
        ../../certs/isrg_root_x1.pem
)
