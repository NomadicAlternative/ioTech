# Design: Firmware OTA Updates from Dashboard

## Technical Approach

Four-layer OTA pipeline: **Dashboard → Backend API → MQTT → ESP32** (fire-and-forget). The backend resolves the latest firmware by the device's template `hardware_model`, publishes `{ version, url }` to `org/{tenantId}/device/{deviceId}/ota/notify` (QoS 1), and records the update. The ESP32 already has a subscribed listener on that topic — it downloads the binary via `esp_https_ota` and reboots into the new partition. The bootloader auto-rolls back on failure (dual-slot already configured). No streaming progress; the device reports its new version on reconnect.

The ESP32's existing 1h poll (GET `/api/firmware/check?current=x.y.z&hardware_model=...`) is left mostly untouched — the new endpoint is a complementary `GET /api/firmware/check` that takes `current` and `hardware_model` as query params and returns the same `{ version, url }` JSON the firmware already parses.

## Architecture Decisions

### Decision: New route on firmware module, not devices module

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Add OTA logic to devices module | Already has MQTT sendCommand pattern; keeps device context together | — |
| Add OTA logic to firmware module | Keeps firmware domain cohesive; `hardware_model` resolution is firmware concern | **Chosen** — the `firmware` module owns version queries; the devices module gets a thin delegation |

**Rationale**: `POST /:id/ota` lives in the firmware routes but delegates to `firmware.service.triggerOta()`. The route is mounted at `POST /api/devices/:id/ota` (handled by firmware routes registered at that path). The devices service is NOT responsible for OTA — that's the firmware domain.

### Decision: `firmware_version` stored on device JSON detail, not separate table

| Option | Tradeoff | Decision |
|--------|----------|----------|
| New `device_firmware` table | Normalized, tracks history | Overkill for fire-and-forget |
| Column on `devices` | Simple, one version per device, easy migration | **Chosen** — `varchar(20)` on `devices` |

**Rationale**: The proposal says fire-and-forget; we only need to show the current version on the device detail page. History tracking is out of scope.

### Decision: Firmware modal selects version; no interim API for "available versions"

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Fetch available firmware for device on dialog open | More dynamic | Simple data flow |
| Pre-fetch firmware list into the device detail page | Works offline; no loading state in dialog | **Chosen** — use existing `useFirmwareStore.fetchFirmwareList()` |

**Rationale**: The firmware list is small (per-tenant), already cached in Zustand. The dialog filters by `hardware_model` client-side. Avoids an extra round-trip.

### Decision: Reuse `ota/notify` topic pattern (existing)

**Choice**: MQTT topic `org/{tenantId}/device/{deviceId}/ota/notify` with payload `{ "version": "1.2.3", "url": "https://..." }`
**Alternatives considered**: New topic `ota/trigger`
**Rationale**: The firmware already subscribes to and parses `ota/notify` in `mqtt_manager.c` line 131-141. No firmware change needed for the topic subscription — we just need to ensure the payload `url` field is properly parsed and passed to `ota_manager_set_url()`.

## Data Flow

```
┌─────────────┐     POST /api/devices/:id/ota      ┌──────────────────┐
│  Dashboard   │ ──────────────────────────────────→│  Backend (firmware│
│  DeviceDetail │                                   │  module)         │
│  Page         │                                   │                  │
│               │                                   │  1. Resolve device by :id
│  [OTA Button] │                                   │  2. Resolve template → hardware_model
│       ↓       │                                   │  3. Query firmware_versions
│  OtaUpdateDialog│                                 │     WHERE hardware_model = ?
│  (select version)│                                │     ORDER BY version DESC LIMIT 1
│       ↓       │                                   │  4. Publish MQTT →
│  Confirm → API│                                   │     org/{tid}/device/{did}/ota/notify
└─────────────┘                                   │     { version, url }
                                                   │  5. UPDATE devices.firmware_version
                                                   │  6. Return 202 { ok: true }
                                                   └──────┬───────────┐
                                                          │           │
                                                    MQTT publish    WebSocket
                                                    (QoS 1)        emit to dashboard
                                                          │           │
                                                   ┌──────▼───────────▼──┐
                                                   │  ESP32 (firmware)    │
                                                   │                     │
                                                   │  mqtt_manager.c     │
                                                   │  receives on        │
                                                   │  ota/notify topic   │
                                                   │       ↓             │
                                                   │  ota_manager.c      │
                                                   │  esp_https_ota()    │
                                                   │  (HTTPS download)   │
                                                   │       ↓             │
                                                   │  esp_restart()      │
                                                   │  (to new partition) │
                                                   └─────────────────────┘
                                                           ↓
                                                   On reconnect:
                                                   Publish status "online"
                                                   with new firmware_version
                                                   in device_config_t

                              ESP32 Periodic Poll (every 60 min):
                              GET /api/firmware/check?current=1.0.0&hardware_model=ESP32
                                     ↓
                              Backend returns { version, url } or 204 No Content
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/src/shared/db/migrations/016_add_firmware_version_to_devices.js` | Create | Add `firmware_version varchar(20)` to `devices` table |
| `backend/src/modules/firmware/firmware.model.js` | Modify | Add `findLatestByHardwareModel()` |
| `backend/src/modules/firmware/firmware.service.js` | Modify | Add `checkLatest()` and `triggerOta()` |
| `backend/src/modules/firmware/firmware.routes.js` | Modify | Add `GET /check` and `POST /devices/:id/ota` |
| `backend/src/modules/firmware/firmware.schemas.js` | Modify | Add `check` and `triggerOta` schemas |
| `backend/src/modules/devices/devices.service.js` | Modify | Add `updateFirmwareVersion()` |
| `backend/src/modules/devices/devices.service.js` | Modify | Add `firmwareVersion` to `camelizeDevice()` |
| `backend/src/modules/devices/devices.model.js` | Modify | No change needed (generic `update()` already exists) |
| `backend/src/app.js` | Modify | Register firmware route at `POST /api/devices/:id/ota` (delegated) |
| `frontend/src/features/firmware/firmwareApi.ts` | Modify | Add `checkFirmware()` and `triggerOta()` |
| `frontend/src/features/devices/components/OtaUpdateDialog.tsx` | Create | Dialog to select firmware version and confirm OTA |
| `frontend/src/features/devices/DeviceDetailPage.tsx` | Modify | Add firmware version badge + OTA button |
| `frontend/src/features/widgets/types.ts` | Modify | Add `firmwareVersion` to `Device` type |
| `firmware/components/mqtt_manager/mqtt_manager.c` | Modify | Parse `url` from `ota/notify` JSON payload and call `ota_manager_set_url()` |
| `firmware/components/mqtt_manager/include/mqtt_manager.h` | Modify | Update `mqtt_ota_cb_t` typedef (currently takes `const char *url`, already correct) |

## Interfaces / Contracts

### API: GET /api/firmware/check

```
Query params:
  current: string  (e.g. "1.0.0") — current firmware version on device
  hardware_model: string (e.g. "ESP32") — device hardware model

Response 200:
  { "version": "1.2.0", "url": "https://cdn.example.com/fw-v1.2.0.bin" }

Response 204:
  (no content — device is already up-to-date)

Validation:
  current: Joi.string().max(20).required()
  hardware_model: Joi.string().max(100).required()
```

### API: POST /api/devices/:id/ota

```
Headers:
  Authorization: Bearer <token>

Request body:
  {}

Response 202:
  { "ok": true, "firmware": { "version": "1.2.0", "url": "https://..." } }

Validation:
  body: Joi.object({})  — no fields (resolves latest by hardware_model)
```

### MQTT — ota/notify command

```
Topic:  org/{tenantId}/device/{deviceId}/ota/notify
QoS:    1
Retain: false

Payload:
  {
    "version": "1.2.0",
    "url": "https://cdn.example.com/firmware-v1.2.0.bin"
  }
```

### MQTT — Backend subscription (to handle firmwareVersion confirmation)

The backend subscribes to `org/+/device/+/status` (already does). When the device reconnects and publishes `"online"`, the heartbeat handler already fires. We extend the heartbeat handler to check if the device's stored `firmware_version` in NVS changed — but this requires the device to publish its version in the status payload. For now, the device just publishes `"online"` as a string. The version update happens optimistically: after the backend publishes `ota/notify`, it immediately sets `firmware_version` in DB.

**Enhancement (future)**: Device can publish `{ "status": "online", "firmware_version": "1.2.0" }` and the backend can confirm/match. For v1 it's fire-and-forget.

### Database — Migration 016

```sql
ALTER TABLE devices
  ADD COLUMN firmware_version VARCHAR(20) DEFAULT NULL;
```

### Frontend — Device type extension

```typescript
// In Device type (widgets/types.ts):
export interface Device {
  // ... existing fields ...
  firmwareVersion: string | null  // camelized from firmware_version
}
```

### ESP32 — `device_config_t` firmware_version field

Already exists in `nvs_storage.h` line 37:
```c
char firmware_version[32]; /**< Last known firmware version after OTA */
```

The OTA poll task already uses `cfg.firmware_version` to compare versions (line 134). The MQTT `ota/notify` handler needs to parse the payload JSON and extract the `url` field — currently it calls `s_ota_cb(data)` passing the raw JSON string. We change this to parse the JSON, extract `url`, call `ota_manager_set_url(url)`, then send `SM_EVT_OTA_NOTIFY`.

## Component Tree

```
DeviceDetailPage
├── Header
│   ├── Back button
│   ├── Device name
│   ├── Online/offline badge
│   ├── Firmware version badge       ← NEW
│   ├── OTA Button                   ← NEW (disabled if offline)
│   ├── Provisioning button
│   └── Flash button
├── Info cards (grid)
│   ├── Device ID
│   ├── Template name
│   └── Created date
├── Relay control grid
│   └── RelayCard × 7
├── Datastreams table
├── Metadata pre
├── OtaUpdateDialog                  ← NEW
│   ├── Firmware version select (filtered by hardware_model)
│   ├── Current version indicator
│   ├── Release notes display
│   └── Confirm / Cancel buttons
├── FlashDeviceWizard
└── ProvisioningModal
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `firmware.service.checkLatest()` — returns latest version vs returns 204 for up-to-date | Mock model, test semver logic |
| Unit | `firmware.service.triggerOta()` — resolves template, queries firmware, publishes MQTT, updates DB | Mock mqttClient, mock firmwareModel, assert publish called with correct topic+payload |
| Unit | `POST /api/devices/:id/ota` schema validation — empty body OK, missing auth rejects | supertest + mocked service |
| Unit | `GET /api/firmware/check` — missing params return 400, valid params call service | supertest + mocked service |
| Integration | Full DB migration: add column, seed device, verify round-trip | Test DB with knex migration |
| Frontend | `OtaUpdateDialog` — renders version list filtered by hardware_model, confirm calls API + toast | Vitest + @testing-library/react |
| Frontend | `DeviceDetailPage` — firmware version badge appears, OTA button disabled when offline | Vitest + component test |
| Firmware | `mqtt_manager.c OTA notify handler` — parse JSON, extract url, call set_url | Native unit test (mock cJSON, mock ota_manager) |

## Migration / Rollout

No migration required for existing data — `firmware_version` column is nullable. Devices created before this change have `NULL`.

**Rollback**:
1. Revert migration 016 (drop `firmware_version` column)
2. Remove `POST /api/devices/:id/ota` from router registration in app.js
3. Remove `GET /api/firmware/check` from firmware routes
4. Revert frontend changes (DeviceDetailPage, OtaUpdateDialog)
5. Revert firmware changes to mqtt_manager.c
6. Devices stay on their current firmware — no data impact

## Open Questions

- [ ] Should the backend subscribe to an `ota/confirm` topic where the device publishes result (success/failure)? Currently fire-and-forget — version is optimistically set. For v1 this is acceptable per the proposal scope.
- [ ] The ESP32 currently publishes `"online"` as a plain string on the status topic. To enable the backend to confirm firmware_version, the device would need to publish JSON `{ "status": "online", "firmware_version": "1.2.0" }`. This is a firmware change for a future iteration.
