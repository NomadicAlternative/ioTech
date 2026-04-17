idf_component_register(
    SRCS "state_machine.c"
    INCLUDE_DIRS "include"
    REQUIRES
        nvs_storage
        wifi_manager
        captive_portal
        provisioning_client
        mqtt_manager
        ota_manager
        factory_reset
        nvs_flash
        esp_wifi
        freertos
)
