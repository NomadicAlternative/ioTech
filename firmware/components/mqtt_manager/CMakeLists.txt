idf_component_register(
    SRCS "mqtt_manager.c"
    INCLUDE_DIRS "include"
    REQUIRES
        nvs_storage
        mqtt
        esp_tls
        freertos
    EMBED_TXTFILES
        ../../certs/isrg_root_x1.pem
)
