## Exploration: OTA Firmware Update from Dashboard

### Executive Summary
The ESP32 firmware **already has complete OTA infrastructure** (dual-slot partitions, HTTPS download via esp_https_ota, MQTT `ota/notify` subscription, state machine with STATE_OTA_UPDATE). What's missing is the backend glue (version check endpoint, OTA notify endpoint, firmware_version tracking on the device model) and the frontend UI (OTA trigger button on DeviceDetailPage).

### Current State

#### Firmware (ESP32) — Already built
- **Partition layout** (`partitions.csv`): `factory` (1MB) + `ota_0` (1MB) + `ota_1` (1MB) + `ota_data` — standard dual-slot OTA with rollback support
- **`ota_manager` component** (`firmware/components/ota_manager/ota_manager.c`):
  - `ota_manager_set_url(url)` — stores firmware binary URL
  - `ota_manager_begin()` — downloads via `esp_https_ota` using ISRG Root X1 CA cert, flashes, sends SM_EVT_OTA_COMPLETE/FAILED
  - `ota_manager_start_poll()` — periodic poll task (every 1h) that calls `GET {backend_url}/api/firmware?current={fw_version}`, parses `{"version":"x.y.z","url":"https://..."}`, runs `ota_semver_compare()` to decide if update is needed
  - `ota_semver_compare()` — semantic version comparison (returns 1 if latest > current)
- **State machine** (`state_machine.c`):
  - STATE_NORMAL transitions to STATE_OTA_UPDATE on SM_EVT_OTA_NOTIFY (MQTT) or SM_EVT_OTA_POLL (timer)
  - STATE_OTA_UPDATE calls `ota_manager_begin()`, then transitions back to STATE_NORMAL on complete/fail
  - On first MQTT connect in STATE_NORMAL, calls `esp_ota_mark_app_valid_cancel_rollback()` — confirming the running OTA partition is good
- **MQTT manager** (`mqtt_manager.c`):
  - Subscribes to `org/{tenantId}/device/{deviceId}/ota/notify` — on message, calls `s_ota_cb(data)` and sends `SM_EVT_OTA_NOTIFY`
  - Also subscribes to `org/{tenantId}/device/{deviceId}/command` for relay control
- **NVS storage** (`nvs_storage.c`): `device_config_t` has `firmware_version[32]` field stored at key `fw_version`
- **PlatformIO** (`platformio.ini`): `CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE=y`, `CONFIG_ESP_HTTPS_OTA_ALLOW_HTTP=0`

#### Backend — Partially built, key endpoint missing
- **Firmware CRUD** (`backend/src/modules/firmware/`):
  - `firmware_versions` table: id, tenant_id, version (varchar 20), hardware_model (varchar 100), release_notes, download_url, timestamps
  - Unique constraint on (version, hardware_model)
  - Routes: GET /api/firmware (list), GET /api/firmware/:id, POST /api/firmware, PATCH /api/firmware/:id, DELETE /api/firmware/:id
  - **MISSING**: `GET /api/firmware/check?current={version}&hardware_model={model}` — the ESP32 OTA poll expects this to return `{"version":"x.y.z","url":"https://..."}`
- **Device model** (`devices.model.js` / migration 004):
  - Table: id, tenant_id, template_id, client_id, device_token, claim_token, hardware_id, name, status, last_seen, metadata, created_at, updated_at
  - **MISSING**: `firmware_version` column — device's current firmware version
- **MQTT command flow** (`devices.service.js`):
  - `sendCommand()` publishes relay commands to `org/{tenantId}/device/{deviceId}/command`
  - **MISSING**: `sendOtaNotify()` — publish to `org/{tenantId}/device/{deviceId}/ota/notify` with `{"version":"x.y.z","url":"https://..."}`
- **MQTT client** (`mqttClient.js`):
  - Already subscribes to `org/{tenantId}/device/{deviceId}/status` (heartbeat)
  - Comment mentions: `// OTA notify (future): org/{tenantId}/device/{deviceId}/ota/notify`
- **Flash flow** (`devices.flash.service.js`, `devices.routes.js:455`):
  - Current flash wizard is USB-only: runs `pio run -e esp32dev` then `pio run --target upload` via SSE
  - This is NOT OTA — it requires physical USB connection

#### Frontend — Missing OTA UI
- **DeviceDetailPage** (`frontend/src/features/devices/DeviceDetailPage.tsx`):
  - Has "Flash & Provision" button (opens USB FlashDeviceWizard)
  - Has "Configurar dispositivo" button (opens ProvisioningModal for Web Serial)
  - **MISSING**: OTA update button for wireless firmware updates
- **FlashDeviceWizard** (`frontend/src/features/devices/components/FlashDeviceWizard.tsx`):
  - SSE consumption of `/api/devices/:id/flash` — shows build/flash progress, then provisioning modal
  - Entirely USB-oriented, not reusable for OTA
- **Firmware CRUD** (`frontend/src/features/firmware/`):
  - Full CRUD via Zustand store: `FirmwareListPage`, `FirmwareForm`, `DeleteFirmwareDialog`
  - Types: `FirmwareVersion` with id, tenant_id, version, hardware_model, release_notes, download_url
- **Device API** (`frontend/src/features/devices/api.ts`):
  - Functions: listDevices, getDevice, createDevice, updateDevice, deleteDevice, sendDeviceCommand, getProvisioningCredentials
  - **MISSING**: `triggerOta()` API call

### Affected Areas
- `firmware/components/ota_manager/ota_manager.c` — minor: ensure MQTT notify payload parsing sets URL before calling begin()
- `firmware/components/mqtt_manager/mqtt_manager.c` — minor: forward OTA notify payload (URL) to ota_manager
- `backend/src/modules/firmware/firmware.model.js` — add `findLatestByHardwareModel()` query
- `backend/src/modules/firmware/firmware.service.js` — add `checkLatest()` method
- `backend/src/modules/firmware/firmware.routes.js` — add `GET /check` endpoint
- `backend/src/modules/devices/devices.service.js` — add `sendOtaNotify()` method
- `backend/src/modules/devices/devices.routes.js` — add `POST /:id/ota` endpoint
- `backend/src/shared/db/migrations/` — new migration: add `firmware_version` to devices
- `backend/src/mqtt/mqttClient.js` — optional: subscribe to ota/notify response topic
- `frontend/src/features/devices/DeviceDetailPage.tsx` — add OTA button
- `frontend/src/features/devices/api.ts` — add `triggerOta()` API function
- `frontend/src/features/devices/components/` — new `OtaUpdateDialog.tsx`

### Approaches

#### 1. Dashboard-initiated OTA via MQTT (recommended)
The installer selects a firmware version from the deployed list, clicks "Update OTA" on the device detail page. The backend publishes an OTA notify message to `org/{tenantId}/device/{deviceId}/ota/notify` with the firmware download URL. The device receives it, downloads via HTTPS, flashes, and reboots.

**Pros:**
- Leverages existing ESP32 OTA infrastructure completely
- Works for devices already in the field (WiFi-connected)
- Real-time — device starts OTA within seconds
- No USB connection required
- Minimal firmware changes (MQTT callback already wired)
- Follows existing MQTT command pattern (relay commands use same topic structure)

**Cons:**
- Requires device to be online (MQTT connected)
- WiFi bandwidth used for ~1MB download
- No progress feedback to dashboard unless we add a response topic

**Effort:** Medium (3 backend endpoints + 1 new frontend component + 1 migration + minor firmware tweaks)

#### 2. Dashboard-initiated OTA via REST
Instead of MQTT, the backend exposes an endpoint that the frontend calls, and the backend sends a REST call to the device's local HTTP endpoint (if one exists).

**Pros:**
- Could use HTTP/2 for faster download
- Direct response with result

**Cons:**
- ESP32 would need an HTTP server (adds complexity, security concerns)
- No existing HTTP server on ESP32 in NORMAL state
- Doesn't fit the existing architecture (MQTT is the command channel)
- Higher effort, more fragile

**Effort:** High

#### 3. Periodic poll only (no dashboard trigger)
Rely solely on the existing 1-hour OTA poll. The installer deploys a new firmware version and waits for devices to pick it up.

**Pros:**
- Zero backend/frontend work needed
- Already implemented in firmware

**Cons:**
- Up to 1 hour delay before devices check
- No manual trigger — installer cannot force immediate update
- No visibility in dashboard about which devices have updated
- The backend endpoint the poll expects (`/api/firmware?current=`) doesn't exist yet

**Effort:** Low (only need the check endpoint + firmware_version tracking)

### Recommendation
**Approach 1 (Dashboard-initiated OTA via MQTT) + Approach 3's poll endpoint as foundation.**

Build the `GET /api/firmware/check` endpoint first (enables periodic poll). Then add the `POST /api/devices/:id/ota` endpoint for dashboard-initiated updates. The same backend logic for checking latest version serves both flows.

The firmware needs one minor tweak: the MQTT `ota/notify` callback currently only sends `SM_EVT_OTA_NOTIFY` without setting the firmware URL. It should parse the JSON payload `{"url":"https://..."}` and call `ota_manager_set_url()` before triggering.

### Risks
- **Firmware binary hosting**: `download_url` in `firmware_versions` currently points to any URL. For production, binaries need to be hosted somewhere accessible by devices (S3, CDN). The PlatformIO build output is `.pio/build/esp32dev/firmware.bin` — no upload step exists.
- **No progress feedback**: The current OTA flow on ESP32 is fire-and-forget. The dashboard won't know if OTA succeeded or failed until the device reboots and reconnects (or doesn't). We could add an `ota/status` response topic later.
- **OTA failure leaves device in old partition**: The ESP-IDF bootloader rollback mechanism should handle this (CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE=y), but it depends on the device calling `esp_ota_mark_app_valid_cancel_rollback()` after successful boot — which it already does on first MQTT connect.
- **Device must be online**: OTA requires active MQTT connection. Devices behind firewalls or with WiFi issues won't receive the command.

### Ready for Proposal
Yes. The firmware infrastructure is already solid. The work is primarily backend glue and frontend UI. Recommend proceeding to `sdd-propose`.
