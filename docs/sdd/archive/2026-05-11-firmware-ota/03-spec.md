# Firmware OTA — Specification

## Purpose

Allow installers to trigger wireless firmware updates on ESP32 devices from the dashboard, and let devices poll for available updates. The ESP32 firmware already handles OTA (dual-slot, HTTPS download, state machine). This spec covers the backend API, DB schema, MQTT contract, and frontend that complete the flow.

---

## Requirements

### OTA-1: Firmware Version Check Endpoint

`GET /api/firmware/check?current={version}&hardware_model={model}` MUST return the latest available firmware for the given hardware model if one exists. The endpoint MUST be public (device-facing, no JWT).

**Scenarios**:
| # | GIVEN | WHEN | THEN |
|---|-------|------|------|
| 1 | A firmware record exists with `hardware_model=esp32dev` and `version=2.0.0`, device sends `current=1.0.0` | `GET /check?current=1.0.0&hardware_model=esp32dev` | 200 `{ version: "2.0.0", url: "https://..." }` |
| 2 | Same hardware_model, device is already at `2.0.0` | `GET /check?current=2.0.0&hardware_model=esp32dev` | 200 `{ upToDate: true }` |
| 3 | No firmware records for the given hardware_model | `GET /check?hardware_model=generic-esp8266` | 200 `{ upToDate: true }` |
| 4 | Missing `hardware_model` param | GET without required param | 400 validation error |

### OTA-2: OTA Trigger Endpoint

`POST /api/devices/:id/ota` MUST authenticate the user (JWT, tenant-scoped), resolve the latest firmware compatible with the device's template's `hardware_model`, publish an MQTT message to `org/{tenantId}/device/{deviceId}/ota/notify`, and return 202 Accepted. The endpoint MUST NOT wait for the device to complete the update.

**Scenarios**:
| # | GIVEN | WHEN | THEN |
|---|-------|------|------|
| 1 | Device exists and is online, template has `hardware_model=esp32dev`, latest firmware `2.0.0` exists | Authed user `POST /devices/:id/ota` with `{ version: "2.0.0" }` | 202; MQTT `ota/notify` published with `{ version: "2.0.0", url: "https://..." }` |
| 2 | Device does not exist OR belongs to another tenant | POST without auth/ownership | 404 |
| 3 | Device template has no `hardware_model` set | POST triggers OTA resolution | 400 `template_missing_hardware_model` |
| 4 | Requested version does not exist in firmware_versions | POST with unknown version | 404 `firmware_not_found` |
| 5 | Device is offline | POST trigger | 202 (fire-and-forget); device picks up MQTT on reconnect (QoS 1) |
| 6 | MQTT client not connected (broker down) | POST trigger | 503 `mqtt_unavailable` |

### OTA-3: MQTT OTA Notify Payload

The backend MUST publish to `org/{tenantId}/device/{deviceId}/ota/notify` with QoS 1. The payload MUST be JSON: `{ "version": "x.y.z", "url": "https://..." }`. The device's existing `mqtt_manager.c` already subscribes to this topic and routes to `s_ota_cb`.

**Scenarios**:
| # | GIVEN | WHEN | THEN |
|---|-------|------|------|
| 1 | Backend publishes valid payload | Device receives in `mqtt_event_handler` `MQTT_EVENT_DATA` | `cJSON_Parse` succeeds; `s_ota_cb` is called with the raw data; `SM_EVT_OTA_NOTIFY` is sent |
| 2 | `s_ota_cb` callback parses `url` from JSON | `s_ota_cb` invokes `ota_manager_set_url(url)` then `sm_send_event(SM_EVT_OTA_NOTIFY)` | ota_manager downloads from URL, flashes, reboots |
| 3 | Payload missing `url` field | Device receives malformed payload | `s_ota_cb` MUST log a warning and NOT trigger OTA |

### OTA-4: Device Firmware Version Update After OTA

When a device reconnects after an OTA update and publishes its status (`"online"` or `{ status: "online", firmwareVersion: "2.0.0" }`), the heartbeat handler MUST update `devices.firmware_version` in the database.

**Scenarios**:
| # | GIVEN | WHEN | THEN |
|---|-------|------|------|
| 1 | Device reboots into new firmware after OTA, connects to MQTT | Device publishes status with `firmwareVersion: "2.0.0"` | DB `devices.firmware_version` updated to `"2.0.0"` |
| 2 | Status payload does not include firmwareVersion | Device publishes plain `"online"` | DB `firmware_version` NOT updated; no error |
| 3 | Status payload includes empty firmwareVersion | Device publishes `{ status: "online", firmwareVersion: "" }` | Field treated as absent; DB NOT updated |

### OTA-5: Database Migration

A migration MUST add `firmware_version varchar(20)` to the `devices` table and `hardware_model varchar(100)` to the `device_templates` table. Existing devices get `NULL` firmware_version; existing templates get `NULL` hardware_model.

**Scenarios**:
| # | GIVEN | WHEN | THEN |
|---|-------|------|------|
| 1 | Up migration runs | `knex migrate:up` | `devices.firmware_version` column exists, nullable; `device_templates.hardware_model` exists, nullable |
| 2 | Down migration runs | `knex migrate:down` | Both columns dropped |
| 3 | Old device with no firmware_version | Data access | Returns `null` — frontend shows `"—"` |

### OTA-6: Frontend — Version Badge

The DeviceDetailPage MUST display the device's `firmware_version` as a badge in the header area, next to the online/offline status badge. If `firmware_version` is null, display `"—"`.

### OTA-7: Frontend — OTA Trigger Button

The DeviceDetailPage MUST show an "Update Firmware" button (admin/installer only) that opens the OtaUpdateDialog. The dialog MUST:
- Fetch available firmware versions for the device's hardware model
- Show a selectable list of versions with release notes
- On confirm, call `POST /api/devices/:id/ota` with the selected version

**Scenarios**:
| # | GIVEN | WHEN | THEN |
|---|-------|------|------|
| 1 | User is admin/installer, device has template with hardware_model | Click "Update Firmware" | Dialog opens; available versions displayed; confirm triggers API call; toast shows "OTA triggered" |
| 2 | No firmware versions available for hardware_model | Dialog opens | Shows empty state "No firmware versions available" |
| 3 | Device has no template or template has no hardware_model | Click button | Toast error: "Cannot resolve firmware target" |
| 4 | OTA API returns 503 (MQTT down) | Confirm in dialog | Toast error: "MQTT broker unavailable — try again" |
| 5 | Device is offline | Button visible, click | Dialog opens; confirm triggers API (fire-and-forget); toast shows "OTA sent — device will update when it reconnects" |

### OTA-8: Error Handling — Download Failure

If the device's OTA download fails (HTTP error, timeout, hash mismatch), the ESP32 already handles this via `SM_EVT_OTA_FAILED` and stays on the current partition. The backend does not need to detect download failure (fire-and-forget by design).

### OTA-9: Rollback

Rollback is handled entirely by the ESP32 dual-slot OTA bootloader per ESP-IDF's native behavior. No dashboard or backend rollback UI is required. If the new firmware fails to boot, the bootloader reverts to the previous slot automatically.

---

## Coverage Summary

| Aspect | Status |
|--------|--------|
| Happy paths | ✅ Version check, OTA trigger, MQTT publish, version update |
| Edge cases | ✅ Offline device, missing hardware_model, unknown version, MQTT down, empty versions |
| Error states | ✅ 400/404/503, missing fields, download failure, dual-slot rollback |
| Auth | ✅ JWT required for trigger; check endpoint is public |
