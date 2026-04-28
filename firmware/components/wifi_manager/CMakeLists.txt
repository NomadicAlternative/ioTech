idf_component_register(
    SRCS "wifi_manager.c"
    INCLUDE_DIRS "include"
    REQUIRES
        sm_events
        nvs_storage
        esp_wifi
        esp_event
        esp_netif
        freertos
)
