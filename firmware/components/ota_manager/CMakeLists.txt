idf_component_register(
    SRCS "ota_manager.c"
    INCLUDE_DIRS "include"
    REQUIRES
        sm_events
        nvs_storage
        mqtt_manager
        app_update
        esp_https_ota
        esp_http_client
        esp-tls
        json
        freertos
    EMBED_TXTFILES
        ../../certs/isrg_root_x1.pem
)
