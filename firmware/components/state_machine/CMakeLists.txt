idf_component_register(
    SRCS "state_machine.c"
    INCLUDE_DIRS "include"
    REQUIRES
        sm_events
        nvs_storage
        wifi_manager
        captive_portal
        provisioning_client
        mqtt_manager
        ota_manager
        factory_reset
        serial_provisioning
        nvs_flash
        esp_wifi
        freertos
)
