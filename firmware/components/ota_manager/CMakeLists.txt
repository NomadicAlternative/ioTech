idf_component_register(
    SRCS "ota_manager.c"
    INCLUDE_DIRS "include"
    REQUIRES
        nvs_storage
        mqtt_manager
        app_update
        esp_https_ota
        esp_http_client
        esp_tls
        freertos
    EMBED_TXTFILES
        ../../certs/isrg_root_x1.pem
)
