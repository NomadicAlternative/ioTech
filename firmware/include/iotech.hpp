/**
 * @file iotech.hpp
 * @brief C++ wrapper layer over the io_driver C engine.
 *
 * Provides Arduino-style classes for all supported sensors, actuators,
 * and displays. Each class delegates to the io_driver C vtable via
 * io_driver_load(), io_driver_read_by_name(), and io_driver_dispatch_command().
 *
 * Usage (user_app.cpp):
 *
 *   #include <iotech.hpp>
 *
 *   DHT22 dht(32);
 *   Relay riego(23, "Bomba");
 *
 *   extern "C" void user_setup() {
 *       dht.begin();
 *       riego.begin();
 *   }
 *
 *   extern "C" void user_loop() {
 *       float temp = dht.readTemperature();
 *       if (temp >= 30.0f) riego.on();
 *       delay(2000);
 *   }
 */

#pragma once

extern "C" {
#include "io_driver_types.h"
#include "io_driver.h"
#include "io_board.h"
#include "cJSON.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <string.h>
#include <math.h>
}

/* ── Global utility ────────────────────────────────────────────────── */

/** Millisecond delay wrapper around FreeRTOS vTaskDelay. */
static inline void delay(unsigned long ms) {
    vTaskDelay(pdMS_TO_TICKS(ms));
}

/* ── Internal helpers ──────────────────────────────────────────────── */

namespace iotech_detail {

/** Search driver read results for a float value by key. Returns NAN if not found. */
inline float findNumberValue(const driver_value_t *values, uint8_t count, const char *key) {
    for (uint8_t i = 0; i < count; i++) {
        if (values[i].type == DRV_VAL_NUMBER && strcmp(values[i].key, key) == 0) {
            return (float)values[i].number_value;
        }
    }
    return NAN;
}

/** Search driver read results for a bool value by key. Returns false if not found. */
inline bool findBoolValue(const driver_value_t *values, uint8_t count, const char *key) {
    for (uint8_t i = 0; i < count; i++) {
        if (values[i].type == DRV_VAL_BOOL && strcmp(values[i].key, key) == 0) {
            return values[i].bool_value;
        }
    }
    return false;
}

} // namespace iotech_detail

/* ── Driver wrapper classes ────────────────────────────────────────── */

/** DHT22 / DHT11 temperature & humidity sensor. */
class DHT22 {
    uint8_t _pin;
    bool    _ready = false;

public:
    explicit DHT22(uint8_t pin) : _pin(pin) {}

    drv_err_t begin() {
        driver_config_t cfg = {};
        cfg.gpio = _pin;
        drv_err_t err = io_driver_load("DHT22", &cfg);
        if (err == DRV_OK) _ready = true;
        return err;
    }

    float readTemperature() {
        if (!_ready) return NAN;
        driver_value_t values[DRV_MAX_VALUES];
        uint8_t count = 0;
        if (io_driver_read_by_name("DHT22", values, &count) != DRV_OK) return NAN;
        return iotech_detail::findNumberValue(values, count, "temperature");
    }

    float readHumidity() {
        if (!_ready) return NAN;
        driver_value_t values[DRV_MAX_VALUES];
        uint8_t count = 0;
        if (io_driver_read_by_name("DHT22", values, &count) != DRV_OK) return NAN;
        return iotech_detail::findNumberValue(values, count, "humidity");
    }
};

/** Relay module (1 channel per instance). Multi-instance via DRV_FLAG_MULTI_INSTANCE. */
class Relay {
    uint8_t     _pin;
    const char *_name;
    char        _activeName[32];
    bool        _state = false;
    bool        _ready = false;

public:
    Relay(uint8_t pin, const char *name) : _pin(pin), _name(name) {}

    drv_err_t begin() {
        driver_config_t cfg = {};
        cfg.gpio     = _pin;
        cfg.channels = 1;
        drv_err_t err = io_driver_load("RELAY", &cfg);
        if (err == DRV_OK) {
            snprintf(_activeName, sizeof(_activeName), "RELAY_%d", _pin);
            _ready = true;
        }
        return err;
    }

    void on() {
        if (!_ready) return;
        cJSON *cmd = cJSON_CreateObject();
        cJSON_AddNumberToObject(cmd, "relay", 1);
        cJSON_AddStringToObject(cmd, "state", "on");
        io_driver_dispatch_command(_activeName, cmd);
        cJSON_Delete(cmd);
        _state = true;
    }

    void off() {
        if (!_ready) return;
        cJSON *cmd = cJSON_CreateObject();
        cJSON_AddNumberToObject(cmd, "relay", 1);
        cJSON_AddStringToObject(cmd, "state", "off");
        io_driver_dispatch_command(_activeName, cmd);
        cJSON_Delete(cmd);
        _state = false;
    }

    bool state() const { return _state; }
};

/** BME280 I2C environmental sensor (temperature, humidity, pressure). */
class BME280 {
    uint8_t _addr;
    bool    _ready = false;

public:
    explicit BME280(uint8_t addr = 0x76) : _addr(addr) {}

    drv_err_t begin() {
        driver_config_t cfg = {};
        cfg.i2c_addr = _addr;
        drv_err_t err = io_driver_load("BME280", &cfg);
        if (err == DRV_OK) _ready = true;
        return err;
    }

    float readTemperature() {
        if (!_ready) return NAN;
        driver_value_t values[DRV_MAX_VALUES];
        uint8_t count = 0;
        if (io_driver_read_by_name("BME280", values, &count) != DRV_OK) return NAN;
        return iotech_detail::findNumberValue(values, count, "temperature");
    }

    float readHumidity() {
        if (!_ready) return NAN;
        driver_value_t values[DRV_MAX_VALUES];
        uint8_t count = 0;
        if (io_driver_read_by_name("BME280", values, &count) != DRV_OK) return NAN;
        return iotech_detail::findNumberValue(values, count, "humidity");
    }

    float readPressure() {
        if (!_ready) return NAN;
        driver_value_t values[DRV_MAX_VALUES];
        uint8_t count = 0;
        if (io_driver_read_by_name("BME280", values, &count) != DRV_OK) return NAN;
        return iotech_detail::findNumberValue(values, count, "pressure");
    }
};

/** PIR HC-SR501 motion sensor. */
class PIR {
    uint8_t _pin;
    bool    _ready = false;

public:
    explicit PIR(uint8_t pin) : _pin(pin) {}

    drv_err_t begin() {
        driver_config_t cfg = {};
        cfg.gpio = _pin;
        drv_err_t err = io_driver_load("PIR", &cfg);
        if (err == DRV_OK) _ready = true;
        return err;
    }

    bool motionDetected() {
        if (!_ready) return false;
        driver_value_t values[DRV_MAX_VALUES];
        uint8_t count = 0;
        if (io_driver_read_by_name("PIR", values, &count) != DRV_OK) return false;
        return iotech_detail::findBoolValue(values, count, "motion");
    }
};

/** HC-SR04 ultrasonic distance sensor. */
class HC_SR04 {
    uint8_t _trig, _echo;
    bool    _ready = false;

public:
    HC_SR04(uint8_t trig, uint8_t echo) : _trig(trig), _echo(echo) {}

    drv_err_t begin() {
        driver_config_t cfg = {};
        cfg.gpio  = _trig;
        cfg.gpio2 = _echo;
        drv_err_t err = io_driver_load("HC-SR04", &cfg);
        if (err == DRV_OK) _ready = true;
        return err;
    }

    float readDistance() {
        if (!_ready) return NAN;
        driver_value_t values[DRV_MAX_VALUES];
        uint8_t count = 0;
        if (io_driver_read_by_name("HC-SR04", values, &count) != DRV_OK) return NAN;
        return iotech_detail::findNumberValue(values, count, "distance");
    }
};

/** Buzzer (active or passive) alarm output. */
class Buzzer {
    uint8_t _pin;
    bool    _ready = false;

public:
    explicit Buzzer(uint8_t pin) : _pin(pin) {}

    drv_err_t begin() {
        driver_config_t cfg = {};
        cfg.gpio = _pin;
        drv_err_t err = io_driver_load("BUZZER", &cfg);
        if (err == DRV_OK) _ready = true;
        return err;
    }

    void beep(uint16_t frequency, uint16_t durationMs) {
        if (!_ready) return;
        cJSON *cmd = cJSON_CreateObject();
        cJSON_AddNumberToObject(cmd, "frequency", frequency);
        cJSON_AddNumberToObject(cmd, "duration_ms", durationMs);
        io_driver_dispatch_command("BUZZER", cmd);
        cJSON_Delete(cmd);
    }
};

/** SSD1306 128x64 monochrome OLED display (I2C). */
class SSD1306 {
    uint8_t _addr;
    bool    _ready = false;

public:
    explicit SSD1306(uint8_t addr = 0x3C) : _addr(addr) {}

    drv_err_t begin() {
        driver_config_t cfg = {};
        cfg.i2c_addr = _addr;
        drv_err_t err = io_driver_load("SSD1306", &cfg);
        if (err == DRV_OK) _ready = true;
        return err;
    }

    void print(const char *text, uint8_t line) {
        if (!_ready) return;
        cJSON *cmd = cJSON_CreateObject();
        cJSON_AddStringToObject(cmd, "text", text);
        cJSON_AddNumberToObject(cmd, "line", line);
        io_driver_dispatch_command("SSD1306", cmd);
        cJSON_Delete(cmd);
    }

    void clear() {
        if (!_ready) return;
        cJSON *cmd = cJSON_CreateObject();
        cJSON_AddStringToObject(cmd, "action", "clear");
        io_driver_dispatch_command("SSD1306", cmd);
        cJSON_Delete(cmd);
    }
};

/** LCD1602 16x2 character display with I2C backpack (PCF8574). */
class LCD1602 {
    uint8_t _addr;
    bool    _ready = false;

public:
    explicit LCD1602(uint8_t addr = 0x27) : _addr(addr) {}

    drv_err_t begin() {
        driver_config_t cfg = {};
        cfg.i2c_addr = _addr;
        drv_err_t err = io_driver_load("LCD1602", &cfg);
        if (err == DRV_OK) _ready = true;
        return err;
    }

    void print(const char *text, uint8_t line) {
        if (!_ready) return;
        cJSON *cmd = cJSON_CreateObject();
        cJSON_AddStringToObject(cmd, "text", text);
        cJSON_AddNumberToObject(cmd, "line", line);
        io_driver_dispatch_command("LCD1602", cmd);
        cJSON_Delete(cmd);
    }

    void clear() {
        if (!_ready) return;
        cJSON *cmd = cJSON_CreateObject();
        cJSON_AddStringToObject(cmd, "action", "clear");
        io_driver_dispatch_command("LCD1602", cmd);
        cJSON_Delete(cmd);
    }

    void setBacklight(bool on) {
        if (!_ready) return;
        cJSON *cmd = cJSON_CreateObject();
        cJSON_AddBoolToObject(cmd, "backlight", on ? 1 : 0);
        io_driver_dispatch_command("LCD1602", cmd);
        cJSON_Delete(cmd);
    }
};

/** WS2812B addressable RGB LED strip (Neopixel). */
class WS2812B {
    uint8_t   _pin;
    uint16_t  _numLeds;
    bool      _ready = false;

public:
    WS2812B(uint8_t pin, uint16_t numLeds) : _pin(pin), _numLeds(numLeds) {}

    drv_err_t begin() {
        driver_config_t cfg = {};
        cfg.gpio     = _pin;
        cfg.channels = _numLeds;
        drv_err_t err = io_driver_load("WS2812B", &cfg);
        if (err == DRV_OK) _ready = true;
        return err;
    }

    void fill(uint8_t r, uint8_t g, uint8_t b) {
        if (!_ready) return;
        cJSON *cmd = cJSON_CreateObject();
        cJSON_AddStringToObject(cmd, "action", "fill");
        cJSON_AddNumberToObject(cmd, "r", r);
        cJSON_AddNumberToObject(cmd, "g", g);
        cJSON_AddNumberToObject(cmd, "b", b);
        io_driver_dispatch_command("WS2812B", cmd);
        cJSON_Delete(cmd);
    }

    void set(uint16_t index, uint8_t r, uint8_t g, uint8_t b) {
        if (!_ready) return;
        cJSON *cmd = cJSON_CreateObject();
        cJSON_AddStringToObject(cmd, "action", "set");
        cJSON_AddNumberToObject(cmd, "index", index);
        cJSON_AddNumberToObject(cmd, "r", r);
        cJSON_AddNumberToObject(cmd, "g", g);
        cJSON_AddNumberToObject(cmd, "b", b);
        io_driver_dispatch_command("WS2812B", cmd);
        cJSON_Delete(cmd);
    }
};

/** Servo motor (SG90/MG996R) PWM control, 0-180°. */
class Servo {
    uint8_t _pin;
    bool    _ready = false;

public:
    explicit Servo(uint8_t pin) : _pin(pin) {}

    drv_err_t begin() {
        driver_config_t cfg = {};
        cfg.gpio = _pin;
        drv_err_t err = io_driver_load("SERVO", &cfg);
        if (err == DRV_OK) _ready = true;
        return err;
    }

    void setAngle(uint8_t degrees) {
        if (!_ready) return;
        if (degrees > 180) degrees = 180;
        cJSON *cmd = cJSON_CreateObject();
        cJSON_AddNumberToObject(cmd, "angle", degrees);
        io_driver_dispatch_command("SERVO", cmd);
        cJSON_Delete(cmd);
    }
};

/** DS18B20 Dallas 1-wire temperature sensor. */
class DS18B20 {
    uint8_t _pin;
    bool    _ready = false;

public:
    explicit DS18B20(uint8_t pin) : _pin(pin) {}

    drv_err_t begin() {
        driver_config_t cfg = {};
        cfg.gpio = _pin;
        drv_err_t err = io_driver_load("DS18B20", &cfg);
        if (err == DRV_OK) _ready = true;
        return err;
    }

    float readTemperature() {
        if (!_ready) return NAN;
        driver_value_t values[DRV_MAX_VALUES];
        uint8_t count = 0;
        if (io_driver_read_by_name("DS18B20", values, &count) != DRV_OK) return NAN;
        return iotech_detail::findNumberValue(values, count, "temperature");
    }
};
