# Proposal: Firmware OTA Updates from Dashboard

## Intent

Let installers trigger wireless firmware updates from the device detail page. ESP32 firmware already has full OTA infrastructure (dual-slot partitions, HTTPS download, MQTT `ota/notify` subscription, state machine). The missing pieces are backend glue, a DB migration, and frontend UI.

## Scope

### In Scope
- Backend `GET /api/firmware/check` endpoint (supports ESP32's 1h poll)
- Backend `POST /api/devices/:id/ota` endpoint (MQTT-triggered OTA)
- DB migration: add `firmware_version` to devices table
- Firmware tweak: parse MQTT ota/notify payload and pass URL to ota_manager
- Frontend OTA button + confirmation dialog on DeviceDetailPage
- Show `firmware_version` on DeviceDetailPage

### Out of Scope
- Firmware binary hosting/upload flow (external URL only)
- OTA progress feedback to dashboard (fire-and-forget)
- Bulk OTA (multi-device at once)
- OTA rollback UI (ESP-IDF bootloader handles rollback automatically)

## Capabilities

### New Capabilities
- `firmware-ota`: Wireless firmware update triggered from dashboard via MQTT, with device version tracking

### Modified Capabilities
- None (no existing capability specs change behavior at spec level)

## Approach

1. **Backend**: Add `findLatestByHardwareModel()` query + `checkLatest()` service to firmware module. Add `POST /:id/ota` to devices routes — resolves latest firmware by device template's hardware_model, publishes `org/{tenantId}/device/{deviceId}/ota/notify` with `{ version, url }` via MQTT, updates `firmware_version` on DB after device confirms.

2. **DB**: Migration adds `firmware_version varchar(20)` to devices table.

3. **Firmware**: Ensure MQTT ota/notify callback parses `url` from JSON payload and calls `ota_manager_set_url()` before sending `SM_EVT_OTA_NOTIFY`.

4. **Frontend**: Add `triggerOta()` API call. New `OtaUpdateDialog` — user picks a firmware version, confirms. OTA button appears in DeviceDetailPage actions along with firmware version badge.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/modules/firmware/firmware.model.js` | Modified | Add `findLatestByHardwareModel()` |
| `backend/src/modules/firmware/firmware.service.js` | Modified | Add `checkLatest()` |
| `backend/src/modules/firmware/firmware.routes.js` | Modified | Add `GET /check` |
| `backend/src/modules/devices/devices.service.js` | Modified | Add `sendOtaNotify()` |
| `backend/src/modules/devices/devices.routes.js` | Modified | Add `POST /:id/ota` |
| `backend/src/shared/db/migrations/` | New | `firmware_version` on devices |
| `firmware/components/ota_manager/ota_manager.c` | Modified | MQTT URL parsing |
| `firmware/components/mqtt_manager/mqtt_manager.c` | Modified | Forward ota/notify payload |
| `frontend/src/features/devices/api.ts` | Modified | Add `triggerOta()` |
| `frontend/src/features/devices/DeviceDetailPage.tsx` | Modified | OTA button + version badge |
| `frontend/src/features/devices/components/` | New | `OtaUpdateDialog.tsx` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Device offline during OTA trigger | Med | MQTT QoS 1; device retries on reconnect or next poll |
| Failed OTA bricks device | Low | Dual-slot + bootloader rollback already enabled |
| Firmware binary URL stale/inaccessible | Low | Validate URL exists before publishing MQTT |

## Rollback Plan

- Revert DB migration, drop `firmware_version` column
- Remove the two new routes from router registrations
- Revert firmware changes to ota_manager / mqtt_manager
- Revert DeviceDetailPage changes
- Device stays on current firmware partition (no impact)

## Dependencies

- MQTT broker reachable by both backend and devices (already running)
- Firmware binaries hosted at accessible HTTPS URLs (external, e.g. GitHub releases)

## Success Criteria

- [ ] `GET /api/firmware/check?current=x.y.z&hardware_model=esp32dev` returns latest version JSON
- [ ] `POST /api/devices/:id/ota` publishes MQTT message on correct topic and returns 202
- [ ] ESP32 receives MQTT, downloads firmware, flashes, reboots into new partition
- [ ] Device reconnects and shows updated `firmware_version` in DB
- [ ] DeviceDetailPage shows firmware version badge and OTA button
- [ ] OTA button opens dialog, selectable firmware list, confirm triggers the API call
