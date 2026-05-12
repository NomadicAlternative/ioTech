/**
 * ioTech — Driver Interface (Standard Contract)
 *
 * Every hardware driver MUST implement this interface.
 * Adding a new sensor/actuator/display = implement these 5 functions + 1 struct.
 *
 * ── How to add a new driver ──────────────────────────────────────────
 *
 * 1. Create driver_foo.c in the right category folder
 * 2. Implement the 5 functions below
 * 3. Add to driver_registry.c
 * 4. Done — the firmware auto-discovers it from provisioning config
 */

#ifndef IOTECH_DRIVER_H
#define IOTECH_DRIVER_H

#include <stdint.h>
#include <stdbool.h>
#include "cJSON.h"

/* ── Capability Types ───────────────────────────────────────────────────── */

typedef enum {
    /* Sensors — Ambient */
    CAP_TEMPERATURE,
    CAP_HUMIDITY,
    CAP_PRESSURE,
    CAP_GAS_RESISTANCE,
    CAP_ALTITUDE,

    /* Sensors — Air quality */
    CAP_CO2,
    CAP_TVOC,
    CAP_PM25,
    CAP_PM10,

    /* Sensors — Motion */
    CAP_MOTION,
    CAP_ACCELEROMETER,
    CAP_GYROSCOPE,

    /* Sensors — Distance */
    CAP_DISTANCE_ULTRASONIC,
    CAP_DISTANCE_LASER,

    /* Sensors — Light */
    CAP_LIGHT_LUX,
    CAP_LIGHT_RAW,

    /* Sensors — Agriculture */
    CAP_SOIL_MOISTURE,
    CAP_WATER_LEVEL,
    CAP_PH,
    CAP_EC,
    CAP_TDS,
    CAP_TURBIDITY,

    /* Sensors — Energy */
    CAP_CURRENT,
    CAP_VOLTAGE,
    CAP_POWER,
    CAP_ENERGY,

    /* Actuators */
    CAP_RELAY,
    CAP_SERVO,
    CAP_STEPPER,
    CAP_LED_RGB,
    CAP_BUZZER,
    CAP_PUMP,
    CAP_VALVE,
    CAP_PWM,

    /* Displays */
    CAP_OLED,
    CAP_TFT,
    CAP_EPAPER,

    /* Input */
    CAP_ENCODER,
    CAP_TOUCH,
    CAP_KEYPAD,
    CAP_BUTTON,
    CAP_RFID,
    CAP_NFC,

    /* Storage */
    CAP_SD_CARD,

    /* Industrial */
    CAP_MODBUS,
    CAP_CAN,

    CAP_COUNT /* sentinel */
} capability_type_t;

/* ── Telemetry Value ────────────────────────────────────────────────────── */

typedef struct {
    capability_type_t capability;
    const char *key;          /* e.g. "temperature", "relay1" */
    const char *unit;         /* e.g. "°C", "%", "lux" */
    union {
        float   f;
        int32_t i;
        bool    b;
        char    s[64];
    } value;
    /* value_type: 0=float, 1=int, 2=bool, 3=string */
    uint8_t value_type;
} telemetry_point_t;

/* ── Driver Interface ───────────────────────────────────────────────────── */

typedef struct driver_s driver_t;

struct driver_s {
    const char *name;          /* Human-readable name: "DHT22 Temperature" */
    const char *model;         /* Hardware model: "DHT22", "SSD1306", etc. */

    /**
     * Initialize the driver with JSON config from provisioning.
     * @param config  cJSON object with driver-specific config (gpio, i2c_addr, etc.)
     * @return true on success
     */
    bool (*init)(const cJSON *config);

    /**
     * Read sensor values. Called on each telemetry cycle.
     * @param points  output array to fill with telemetry points
     * @param max     max number of points that fit in the array
     * @return        number of points written
     */
    int (*read)(telemetry_point_t *points, int max);

    /**
     * Write / actuate. Called on MQTT command receipt.
     * @param key    actuator key (e.g. "relay1")
     * @param value  JSON value from command
     * @return true on success
     */
    bool (*write)(const char *key, const cJSON *value);

    /**
     * Get current state for dashboard display.
     * @param points  output array
     * @param max     max points
     * @return        number of points written
     */
    int (*get_state)(telemetry_point_t *points, int max);

    /**
     * Cleanup / deinit. Called on reboot or driver swap.
     */
    void (*deinit)(void);
};

/* ── Driver Registry ────────────────────────────────────────────────────── */

/**
 * Register a driver so it can be activated by provisioning config.
 * Called once at boot for each compiled-in driver.
 */
void driver_register(driver_t *driver);

/**
 * Activate drivers matching the provisioning config.
 * @param config  the full provisioning JSON (wifi, mqtt, drivers array)
 * @return        number of drivers activated
 */
int driver_activate_all(const cJSON *config);

/**
 * Read all active sensor drivers.
 * @param buf     output buffer for MQTT telemetry JSON
 * @param buf_len buffer size
 * @return        length of JSON written (0 if none)
 */
int driver_read_all_telemetry(char *buf, int buf_len);

/**
 * Route an incoming MQTT command to the matching actuator driver.
 * @param topic   MQTT topic suffix (after device/ID/)
 * @param payload JSON payload
 * @return        true if a driver handled it
 */
bool driver_write_command(const char *topic, const cJSON *payload);

#endif /* IOTECH_DRIVER_H */
