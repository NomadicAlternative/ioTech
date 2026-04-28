idf_component_register(
    SRCS "captive_portal.c"
    INCLUDE_DIRS "include"
    REQUIRES
        nvs_storage
        wifi_manager
        esp_wifi
        esp_http_server
        esp_netif
        lwip
        freertos
        efuse
    EMBED_TXTFILES
        ../../data/portal/index.html
        ../../data/portal/styles.css
        ../../data/portal/app.js
)
