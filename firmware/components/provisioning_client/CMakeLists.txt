idf_component_register(
    SRCS "provisioning_client.c"
    INCLUDE_DIRS "include"
    REQUIRES
        sm_events
        nvs_storage
        esp_http_client
        esp-tls
        json
        freertos
)
