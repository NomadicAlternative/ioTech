idf_component_register(
    SRCS "provisioning_client.c"
    INCLUDE_DIRS "include"
    REQUIRES
        nvs_storage
        esp_http_client
        esp_tls
        json
        freertos
)
