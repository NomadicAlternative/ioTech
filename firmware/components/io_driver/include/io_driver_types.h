/**
 * @file io_driver_types.h
 * @brief Core types for the io_driver engine, PAL, and all driver implementations.
 *
 * This header is free of ESP-IDF dependencies (no driver/gpio.h, etc.)
 * to allow host-side testing against PAL mocks.
 */
#pragma once

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/* ── Return codes ─────────────────────────────────────────────────── */

/** Driver-specific status codes. ESP-IDF esp_err_t is used at PAL boundary only. */
typedef enum {
    DRV_OK             =  0,
    DRV_ERR_ARG        = -1,   /**< Invalid argument (gpio=255 sentinel, zero channels) */
    DRV_ERR_NOT_FOUND  = -2,   /**< Driver name not in registry */
    DRV_ERR_STATE      = -3,   /**< Already registered, or not initialized */
    DRV_ERR_TIMEOUT    = -4,   /**< Sensor read timeout */
    DRV_ERR_CHECKSUM   = -5,   /**< Sensor checksum mismatch */
    DRV_ERR_NOT_SUPP   = -6,   /**< Command not supported by this driver */
    DRV_ERR_BUS        = -7,   /**< I2C/1-wire bus error */
    DRV_ERR_INTERNAL   = -99,  /**< Catch-all internal error */
} drv_err_t;

/** Return a human-readable string for a drv_err_t code. */
static inline const char *drv_err_str(drv_err_t code) {
    switch (code) {
    case DRV_OK:             return "OK";
    case DRV_ERR_ARG:        return "INVALID_ARG";
    case DRV_ERR_NOT_FOUND:  return "NOT_FOUND";
    case DRV_ERR_STATE:      return "INVALID_STATE";
    case DRV_ERR_TIMEOUT:    return "TIMEOUT";
    case DRV_ERR_CHECKSUM:   return "CHECKSUM";
    case DRV_ERR_NOT_SUPP:   return "NOT_SUPPORTED";
    case DRV_ERR_BUS:        return "BUS_ERROR";
    default:                 return "UNKNOWN";
    }
}

/* ── Value types ──────────────────────────────────────────────────── */

typedef enum {
    DRV_VAL_NUMBER = 0,
    DRV_VAL_STRING = 1,
    DRV_VAL_BOOL   = 2,
} driver_value_type_t;

typedef struct {
    char                 key[32];          /**< Datastream key: "temperature", "relay1" */
    driver_value_type_t  type;
    union {
        double            number_value;   /**< For DRV_VAL_NUMBER */
        char              string_value[64]; /**< For DRV_VAL_STRING */
        bool              bool_value;      /**< For DRV_VAL_BOOL */
    };
} driver_value_t;

/** Maximum values a single read() call can return */
#define DRV_MAX_VALUES 16

/* ── Configuration ────────────────────────────────────────────────── */

/** Sentinel for "GPIO not configured" */
#define DRV_GPIO_NONE  0xFFU

typedef struct {
    uint8_t  gpio;          /**< Primary GPIO (or DRV_GPIO_NONE if I2C-only) */
    uint8_t  gpio2;         /**< Secondary GPIO (HC-SR04 echo, WS2812B data) */
    uint16_t i2c_addr;      /**< 7-bit I2C address (0 if GPIO-only, e.g. 0x76) */
    uint8_t  i2c_sda;       /**< SDA pin (board-resolved) */
    uint8_t  i2c_scl;       /**< SCL pin (board-resolved) */
    uint8_t  channels;      /**< Number of channels (relay), LEDs (WS2812B) */
    void    *custom;        /**< Driver-specific config blob (DHT model, BME280 oversampling) */
} driver_config_t;

/* ── Driver vtable ─────────────────────────────────────────────────── */

/** Forward declaration */
typedef struct driver_interface driver_t;

struct driver_interface {
    /**
     * Unique driver name — matches `driver_name` in backend datastreams
     * and the action name in MQTT commands.
     * MUST be <= 16 chars and uppercase by convention.
     */
    const char *name;

    /**
     * Initialize driver with resolved configuration.
     * Called once at boot. Must be idempotent.
     *
     * @param cfg  Resolved config (GPIOs from board map, I2C addr from template).
     * @return DRV_OK or DRV_ERR_ARG.
     */
    drv_err_t (*init)(const driver_config_t *cfg);

    /**
     * Read sensor values or actuator state.
     *
     * @param values  OUT: array of driver_value_t. Caller provides DRV_MAX_VALUES slots.
     * @param count   OUT: number of values populated (0..DRV_MAX_VALUES).
     * @return DRV_OK, DRV_ERR_TIMEOUT, DRV_ERR_CHECKSUM, DRV_ERR_BUS.
     */
    drv_err_t (*read)(driver_value_t *values, uint8_t *count);

    /**
     * Execute an actuator command.
     *
     * @param action  Command name ("relay", "servo_set", "ws2812b_fill", etc.).
     * @param arg     Driver-specific argument (cJSON* for complex, simple struct for others).
     * @return DRV_OK, DRV_ERR_ARG, DRV_ERR_NOT_SUPP.
     */
    drv_err_t (*command)(const char *action, const void *arg);

    /**
     * De-initialize driver. Release resources. Must be idempotent.
     * All driver state should be reset so init() can be called again.
     *
     * @return DRV_OK.
     */
    drv_err_t (*deinit)(void);
};

/* ── Registry / Active list bounds ─────────────────────────────────── */

#define IO_DRIVER_MAX_REGISTRY 16  /**< Max compile-time registered drivers */
#define IO_DRIVER_MAX_ACTIVE   16  /**< Max simultaneously loaded drivers */

/* ── Linker-set auto-registration macro ────────────────────────────── */

/**
 * Place a driver pointer in the .io_drivers linker section.
 * The engine iterates this section at init to auto-discover all
 * linked drivers.
 *
 * Usage (one per driver's .c file):
 *   IO_DRIVER_REGISTER(drv_dht22);
 */
#define IO_DRIVER_REGISTER(drv) \
    static const driver_t *__io_driver_##drv \
        __attribute__((used, section(".io_drivers"))) = &drv; \
    const driver_t *g_##drv = &drv

#ifdef __cplusplus
}
#endif
