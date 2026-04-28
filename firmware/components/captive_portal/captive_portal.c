#include <string.h>
#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "esp_http_server.h"
#include "lwip/sockets.h"
#include "lwip/dns.h"
#include "esp_efuse.h"
#include "esp_mac.h"

#include "captive_portal.h"
#include "nvs_storage.h"

static const char *TAG = "captive_portal";

static captive_portal_on_done_cb_t s_on_done_cb = NULL;

/* Embedded portal HTML via EMBED_TXTFILES in CMakeLists.txt */
extern const char index_html_start[] asm("_binary_index_html_start");
extern const char index_html_end[]   asm("_binary_index_html_end");
extern const char styles_css_start[] asm("_binary_styles_css_start");
extern const char styles_css_end[]   asm("_binary_styles_css_end");
extern const char app_js_start[]     asm("_binary_app_js_start");
extern const char app_js_end[]       asm("_binary_app_js_end");

static httpd_handle_t s_httpd = NULL;
static bool s_portal_started = false;  /* W1: track if portal is actually running */

/* -----------------------------------------------------------------------
 * DNS redirect server (redirects all queries to our IP)
 * --------------------------------------------------------------------- */
#define DNS_PORT 53
#define DNS_MAX_PKT 512

static void dns_redirect_task(void *arg)
{
    int sock = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
    if (sock < 0) {
        ESP_LOGE(TAG, "DNS socket failed");
        vTaskDelete(NULL);
        return;
    }

    struct sockaddr_in server_addr = {
        .sin_family      = AF_INET,
        .sin_port        = htons(DNS_PORT),
        .sin_addr.s_addr = htonl(INADDR_ANY),
    };
    bind(sock, (struct sockaddr *)&server_addr, sizeof(server_addr));

    uint8_t buf[DNS_MAX_PKT];
    struct sockaddr_in client_addr;
    socklen_t addrlen = sizeof(client_addr);

    ESP_LOGI(TAG, "DNS redirect server running on port 53");

    while (1) {
        int len = recvfrom(sock, buf, sizeof(buf), 0,
                           (struct sockaddr *)&client_addr, &addrlen);
        if (len < 0) continue;

        /* Craft a minimal DNS response pointing to our IP (192.168.4.1) */
        buf[2] = 0x81; /* QR=1 (response), OPCODE=0, AA=1 */
        buf[3] = 0x80; /* RA=1 */
        buf[6] = 0x00; /* ANCOUNT high byte */
        buf[7] = 0x01; /* ANCOUNT = 1 */

        /* Append answer section: name pointer + A record */
        uint8_t answer[] = {
            0xC0, 0x0C,       /* Name: pointer to question */
            0x00, 0x01,       /* Type: A */
            0x00, 0x01,       /* Class: IN */
            0x00, 0x00, 0x00, 0x3C, /* TTL: 60s */
            0x00, 0x04,       /* RDLENGTH: 4 bytes */
            192, 168, 4, 1    /* Our IP */
        };

        if (len + (int)sizeof(answer) < DNS_MAX_PKT) {
            memcpy(buf + len, answer, sizeof(answer));
            sendto(sock, buf, len + sizeof(answer), 0,
                   (struct sockaddr *)&client_addr, addrlen);
        }
    }

    close(sock);
    vTaskDelete(NULL);
}

/* -----------------------------------------------------------------------
 * HTTP handlers
 * --------------------------------------------------------------------- */
static esp_err_t handle_get_root(httpd_req_t *req)
{
    size_t html_len = index_html_end - index_html_start;
    httpd_resp_set_type(req, "text/html");
    httpd_resp_send(req, index_html_start, (ssize_t)html_len);
    return ESP_OK;
}

static esp_err_t handle_get_css(httpd_req_t *req)
{
    size_t css_len = styles_css_end - styles_css_start;
    httpd_resp_set_type(req, "text/css");
    httpd_resp_send(req, styles_css_start, (ssize_t)css_len);
    return ESP_OK;
}

static esp_err_t handle_get_js(httpd_req_t *req)
{
    size_t js_len = app_js_end - app_js_start;
    httpd_resp_set_type(req, "application/javascript");
    httpd_resp_send(req, app_js_start, (ssize_t)js_len);
    return ESP_OK;
}

/* Helper: extract a field value from a URL-encoded form body */
static int extract_field(const char *body, const char *key, char *out, size_t out_len)
{
    char search[64];
    snprintf(search, sizeof(search), "%s=", key);
    const char *p = strstr(body, search);
    if (!p) return -1;

    p += strlen(search);
    const char *end = strchr(p, '&');
    size_t field_len = end ? (size_t)(end - p) : strlen(p);

    if (field_len >= out_len) return -1;
    memcpy(out, p, field_len);
    out[field_len] = '\0';

    /* S1 FIX: URL decode: replace '+' with ' ' and decode %XX sequences */
    char *w = out;
    const char *r = out;
    while (*r) {
        if (*r == '+') {
            *w++ = ' ';
            r++;
        } else if (*r == '%' && r[1] && r[2]) {
            char hex[3] = { r[1], r[2], '\0' };
            *w++ = (char)strtol(hex, NULL, 16);
            r += 3;
        } else {
            *w++ = *r++;
        }
    }
    *w = '\0';
    return 0;
}

static esp_err_t handle_post_provision(httpd_req_t *req)
{
    char body[512] = {0};
    int received = httpd_req_recv(req, body, sizeof(body) - 1);
    if (received <= 0) {
        httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "Empty body");
        return ESP_FAIL;
    }

    char ssid[64]        = {0};
    char password[64]    = {0};
    char claim_token[64] = {0};
    char backend_url[128]= {0};

    if (extract_field(body, "ssid",        ssid,        sizeof(ssid))        < 0 ||
        extract_field(body, "claim_token", claim_token, sizeof(claim_token)) < 0 ||
        extract_field(body, "backend_url", backend_url, sizeof(backend_url)) < 0)
    {
        const char *err_resp = "<html><body><h2>Error: all fields are required</h2>"
                               "<a href='/'>Back</a></body></html>";
        httpd_resp_set_status(req, "400 Bad Request");
        httpd_resp_set_type(req, "text/html");
        httpd_resp_sendstr(req, err_resp);
        return ESP_OK;
    }

    /* Password is optional (open networks) */
    extract_field(body, "password", password, sizeof(password));

    /* Validate required fields are non-empty */
    if (strlen(ssid) == 0 || strlen(claim_token) == 0 || strlen(backend_url) == 0) {
        const char *err_resp = "<html><body><h2>Error: SSID, claim token and backend URL required</h2>"
                               "<a href='/'>Back</a></body></html>";
        httpd_resp_set_status(req, "400 Bad Request");
        httpd_resp_set_type(req, "text/html");
        httpd_resp_sendstr(req, err_resp);
        return ESP_OK;
    }

    /* Store credentials in NVS */
    wifi_creds_t creds = {0};
    strlcpy(creds.ssid,     ssid,     sizeof(creds.ssid));
    strlcpy(creds.password, password, sizeof(creds.password));
    nvs_store_credentials(&creds);

    /* Store provisioning config */
    device_config_t cfg = {0};
    strlcpy(cfg.claim_token, claim_token, sizeof(cfg.claim_token));
    strlcpy(cfg.backend_url, backend_url, sizeof(cfg.backend_url));
    nvs_store_device_config(&cfg);

    httpd_resp_set_type(req, "text/html");
    httpd_resp_sendstr(req, "<html><body><h2>Connecting...</h2>"
                            "<p>The device is connecting to your network.</p></body></html>");

    /* Signal state machine via callback */
    if (s_on_done_cb) s_on_done_cb();
    return ESP_OK;
}

/* Redirect any unknown URI to the portal (captive portal behaviour) */
static esp_err_t handle_redirect(httpd_req_t *req)
{
    httpd_resp_set_status(req, "302 Found");
    httpd_resp_set_hdr(req, "Location", "http://192.168.4.1/");
    httpd_resp_send(req, NULL, 0);
    return ESP_OK;
}

/* -----------------------------------------------------------------------
 * SoftAP + HTTP server startup
 * --------------------------------------------------------------------- */
static void start_softap(void)
{
    uint8_t mac[6];
    esp_efuse_mac_get_default(mac);

    char ssid[32];
    snprintf(ssid, sizeof(ssid), "ioTech-%02X%02X", mac[4], mac[5]);

    esp_netif_create_default_wifi_ap();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    wifi_config_t ap_config = {0};
    strlcpy((char *)ap_config.ap.ssid, ssid, sizeof(ap_config.ap.ssid));
    ap_config.ap.ssid_len       = strlen(ssid);
    ap_config.ap.channel        = 1;
    ap_config.ap.authmode       = WIFI_AUTH_OPEN;
    ap_config.ap.max_connection = 4;

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_AP));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_AP, &ap_config));
    ESP_ERROR_CHECK(esp_wifi_start());

    ESP_LOGI(TAG, "SoftAP started — SSID: %s", ssid);
}

static void start_httpd(void)
{
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.uri_match_fn   = httpd_uri_match_wildcard;

    if (httpd_start(&s_httpd, &config) != ESP_OK) {
        ESP_LOGE(TAG, "Failed to start HTTP server");
        return;
    }

    httpd_uri_t uri_root    = { .uri = "/",           .method = HTTP_GET,  .handler = handle_get_root,       .user_ctx = NULL };
    httpd_uri_t uri_css     = { .uri = "/styles.css", .method = HTTP_GET,  .handler = handle_get_css,        .user_ctx = NULL };
    httpd_uri_t uri_js      = { .uri = "/app.js",     .method = HTTP_GET,  .handler = handle_get_js,         .user_ctx = NULL };
    httpd_uri_t uri_prov    = { .uri = "/provision",  .method = HTTP_POST, .handler = handle_post_provision, .user_ctx = NULL };
    httpd_uri_t uri_catch   = { .uri = "/*",          .method = HTTP_GET,  .handler = handle_redirect,       .user_ctx = NULL };

    httpd_register_uri_handler(s_httpd, &uri_root);
    httpd_register_uri_handler(s_httpd, &uri_css);
    httpd_register_uri_handler(s_httpd, &uri_js);
    httpd_register_uri_handler(s_httpd, &uri_prov);
    httpd_register_uri_handler(s_httpd, &uri_catch);

    ESP_LOGI(TAG, "HTTP server started");
}

/* -----------------------------------------------------------------------
 * Public API
 * --------------------------------------------------------------------- */
void captive_portal_start(captive_portal_on_done_cb_t on_done)
{
    ESP_LOGI(TAG, "Starting captive portal...");
    s_on_done_cb = on_done;
    s_portal_started = true;
    start_softap();
    start_httpd();
    xTaskCreate(dns_redirect_task, "dns_redirect", 4096, NULL, 5, NULL);
}

void captive_portal_stop(void)
{
    /* W1 FIX: only stop if actually started — prevents calling esp_wifi_stop()
       when transitioning INIT → CONNECTING (portal was never running) */
    if (!s_portal_started) {
        return;
    }
    if (s_httpd) {
        httpd_stop(s_httpd);
        s_httpd = NULL;
    }
    esp_wifi_stop();
    s_portal_started = false;
    ESP_LOGI(TAG, "Captive portal stopped");
}
