/**
 * @file pal_rmt.c
 * @brief PAL RMT — compile-time target branching for ESP32 vs C3.
 */
#include "pal_rmt.h"
#include "driver/rmt.h"
#include "esp_log.h"

#if CONFIG_IDF_TARGET_ESP32C3
    #include "driver/rmt_tx.h"
#endif

static const char *TAG = "pal_rmt";

#define MAX_RMT_CHANNELS 4

#if CONFIG_IDF_TARGET_ESP32C3
static rmt_channel_handle_t s_tx_channels[MAX_RMT_CHANNELS] = {NULL};
#else
static bool s_channels_installed[MAX_RMT_CHANNELS] = {false};
#endif

esp_err_t pal_rmt_init_tx(uint8_t channel, uint8_t gpio,
                           uint32_t resolution_hz, size_t mem_blocks)
{
    if (channel >= MAX_RMT_CHANNELS) {
        ESP_LOGE(TAG, "RMT channel %u out of range (max %d)", channel, MAX_RMT_CHANNELS - 1);
        return ESP_ERR_INVALID_ARG;
    }

#if CONFIG_IDF_TARGET_ESP32C3
    rmt_tx_channel_config_t tx_cfg = {
        .gpio_num          = gpio,
        .clk_src           = RMT_CLK_SRC_DEFAULT,
        .resolution_hz     = resolution_hz,
        .mem_block_symbols = mem_blocks,  /* C3: mem_block_symbols, not mem_block_num */
        .trans_queue_depth = 4,
    };
    rmt_channel_handle_t tx_chan = NULL;
    esp_err_t err = rmt_new_tx_channel(&tx_cfg, &tx_chan);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "rmt_new_tx_channel failed: %s", esp_err_to_name(err));
        return err;
    }
    err = rmt_enable(tx_chan);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "rmt_enable failed: %s", esp_err_to_name(err));
        return err;
    }
    s_tx_channels[channel] = tx_chan;
    return ESP_OK;

#elif CONFIG_IDF_TARGET_ESP32 || CONFIG_IDF_TARGET_ESP32S3
    rmt_config_t cfg = RMT_DEFAULT_CONFIG_TX(gpio, (rmt_channel_t)channel);
    cfg.clk_div = 2; /* 40 MHz APB / 2 = 20 MHz → 50 ns resolution */
    esp_err_t err = rmt_config(&cfg);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "rmt_config failed: %s", esp_err_to_name(err));
        return err;
    }
    err = rmt_driver_install((rmt_channel_t)channel, 0, 0);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "rmt_driver_install failed: %s", esp_err_to_name(err));
        return err;
    }
    s_channels_installed[channel] = true;
    return ESP_OK;

#else
    #error "Unsupported ESP32 target for PAL RMT"
#endif
}

esp_err_t pal_rmt_write_items(uint8_t channel, const void *items,
                               size_t count, bool wait)
{
    if (channel >= MAX_RMT_CHANNELS) return ESP_ERR_INVALID_ARG;

#if CONFIG_IDF_TARGET_ESP32C3
    rmt_channel_handle_t tx_chan = s_tx_channels[channel];
    if (!tx_chan) return ESP_ERR_INVALID_STATE;

    /* On C3 we need a simple copy encoder for raw items */
    rmt_copy_encoder_config_t enc_cfg = {};
    rmt_encoder_handle_t encoder = NULL;
    esp_err_t err = rmt_new_copy_encoder(&enc_cfg, &encoder);
    if (err != ESP_OK) return err;

    rmt_transmit_config_t tx_conf = {
        .loop_count = 0,
    };
    err = rmt_transmit(tx_chan, encoder, items,
                       count * sizeof(rmt_item32_t), &tx_conf);
    /* encoder must live until transmit completes; for simplicity we
       wait here. In production, use rmt_del_encoder in a callback. */
    if (wait) {
        rmt_tx_wait_all_done(tx_chan, pdMS_TO_TICKS(100));
    }
    rmt_del_encoder(encoder);
    return err;

#elif CONFIG_IDF_TARGET_ESP32 || CONFIG_IDF_TARGET_ESP32S3
    if (!s_channels_installed[channel]) return ESP_ERR_INVALID_STATE;
    return rmt_write_items((rmt_channel_t)channel,
                           (const rmt_item32_t *)items,
                           (int)count, wait);
#else
    return ESP_FAIL;
#endif
}

esp_err_t pal_rmt_deinit_tx(uint8_t channel)
{
    if (channel >= MAX_RMT_CHANNELS) return ESP_ERR_INVALID_ARG;

#if CONFIG_IDF_TARGET_ESP32C3
    if (s_tx_channels[channel]) {
        rmt_disable(s_tx_channels[channel]);
        rmt_del_channel(s_tx_channels[channel]);
        s_tx_channels[channel] = NULL;
    }
    return ESP_OK;
#elif CONFIG_IDF_TARGET_ESP32 || CONFIG_IDF_TARGET_ESP32S3
    if (s_channels_installed[channel]) {
        rmt_driver_uninstall((rmt_channel_t)channel);
        s_channels_installed[channel] = false;
    }
    return ESP_OK;
#else
    return ESP_FAIL;
#endif
}
