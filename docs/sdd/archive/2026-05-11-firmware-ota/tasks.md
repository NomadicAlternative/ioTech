# Tasks: Firmware OTA Updates from Dashboard

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~580–680 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Backend + Migration) → PR 2 (Frontend) → PR 3 (Firmware) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Base Branch |
|------|------|-----------|-------------|
| 1 | Backend: DB migration + firmware check + OTA trigger + MQTT + heartbeat version sync | PR 1 | main |
| 2 | Frontend: Device type + firmwareApi + OTA dialog + badge + button | PR 2 | main (after PR 1) |
| 3 | Firmware: mqtt_manager.c OTA notify payload parsing | PR 3 | main (after PR 2) |

---

## Phase 1: Foundation — DB Migration

- [x] 1.1 Create `016_add_firmware_columns.js` — add `firmware_version varchar(20)` to devices, `hardware_model varchar(100)` to device_templates, both nullable
  - Files: `backend/src/shared/db/migrations/016_add_firmware_columns.js` (create)
  - Test plan: knex migrate:up then migrate:down — verify columns exist then drop
  - Deps: none | Est: 25 lines

- [x] 1.2 Migration round-trip test — verify schema changes via information_schema
  - Files: `backend/src/__tests__/migrations/016_firmware_columns.test.js` (create)
  - Deps: 1.1 | Est: 40 lines

## Phase 2: Backend — Firmware Check Endpoint

- [x] 2.1 Add `findLatestByHardwareModel(hardwareModel)` to firmware model
  - Files: `backend/src/modules/firmware/firmware.model.js` (modify)
  - Test plan: unit test — insert 2 records same model, assert returns highest version; empty = undefined
  - Deps: 1.1 | Est: 8 lines

- [x] 2.2 Add `checkLatest(current, hardwareModel)` to firmware service
  - Files: `backend/src/modules/firmware/firmware.service.js` (modify)
  - Test plan: mock model returns latest → assert `{ version, url }`; up-to-date → `{ upToDate: true }`
  - Deps: 2.1 | Est: 15 lines

- [x] 2.3 Add `GET /check` route (no auth guard) + Joi query schema
  - Files: `backend/src/modules/firmware/firmware.routes.js`, `firmware.schemas.js` (modify)
  - Test plan: supertest — 200 found, 204 up-to-date, 400 missing param
  - Deps: 2.2 | Est: 25 lines

## Phase 3: Backend — OTA Trigger Endpoint

- [x] 3.1 Add `triggerOta(tenantId, deviceId, version?)` — resolve device→template→hw_model→latest fw, publish MQTT, update device firmware_version
  - Files: `backend/src/modules/firmware/firmware.service.js` (modify)
  - Test plan: mock chain resolution, assert MQTT to correct topic + device.firmware_version updated
  - Deps: 2.1 | Est: 50 lines

- [x] 3.2 Add `POST /devices/:id/ota` route (authed) + Joi schema
  - Files: `backend/src/modules/firmware/firmware.routes.js`, `firmware.schemas.js` (modify)
  - Test plan: supertest — 202 success, 404, 400, 503 scenarios per spec OTA-2
  - Deps: 3.1 | Est: 30 lines

## Phase 4: Backend — Heartbeat Firmware Version Sync

- [x] 4.1 Update `handleHeartbeat` to extract firmwareVersion from JSON payload
  - Files: `backend/src/mqtt/handlers/heartbeat.js` (modify)
  - Test plan: firmwareVersion present → update called; plain string → not called; empty → not called
  - Deps: 1.1 | Est: 12 lines

- [x] 4.2 Add `firmwareVersion` to `camelizeDevice()`
  - Files: `backend/src/modules/devices/devices.service.js` (modify)
  - Test plan: row with `firmware_version: '2.0.0'` → output has `firmwareVersion`; null → null
  - Deps: 1.1 | Est: 3 lines

## Phase 5: Frontend — API Layer & Types

- [x] 5.1 Add `firmwareVersion: string | null` to Device type
  - Files: `frontend/src/features/widgets/types.ts` (modify)
  - Test plan: type check compiles with and without firmwareVersion
  - Deps: none | Est: 2 lines

- [x] 5.2 Add `triggerOta(deviceId)` and `checkFirmware(hardwareModel)` to firmwareApi
  - Files: `frontend/src/features/firmware/firmwareApi.ts` (modify)
  - Test plan: Vitest + axios mock — verify URL, method, payload
  - Deps: none | Est: 18 lines

## Phase 6: Frontend — OTA Dialog & Button

- [x] 6.1 Create `OtaUpdateDialog.tsx` — modal with firmware select (filtered by hw_model from Zustand), current version, release notes, confirm/cancel
  - Files: `frontend/src/features/devices/components/OtaUpdateDialog.tsx` (create)
  - Test plan: Vitest + RTL — render versions, confirm calls API, empty state, cancel closes
  - Deps: 5.2 | Est: 100 lines

- [x] 6.2 Wire firmware badge + OTA button into DeviceDetailPage
  - Files: `frontend/src/features/devices/DeviceDetailPage.tsx` (modify)
  - Test plan: badge renders version, button visible for admin/installer, opens dialog on click
  - Deps: 6.1, 5.1 | Est: 35 lines

## Phase 7: Firmware — MQTT Manager OTA Payload Parsing

- [x] 7.1 Parse `url` from ota/notify JSON in mqtt_event_handler before calling s_ota_cb
  - Files: `firmware/components/mqtt_manager/mqtt_manager.c` (modify)
  - Test plan: valid → callback with url; missing url → log warning, no callback; invalid JSON → log, no callback
  - Deps: none | Est: 25 lines

## Phase 8: Backend Integration Tests

- [x] 8.1 Full OTA flow integration test — seed data, check endpoint, trigger endpoint, MQTT mock
  - Files: `backend/src/__tests__/firmware-ota.integration.test.js` (create)
  - Deps: 3.2, 2.3 | Est: 80 lines

## Phase 9: Cleanup

- [x] 9.1 Reorder routes so `GET /check` is public before authGuard
  - Files: `backend/src/modules/firmware/firmware.routes.js` (modify)
  - Deps: 2.3 | Est: 5 lines

---

## Implementation Order

1. **Phase 1** — migration foundation
2. **Phases 2-4** — backend core (check, trigger, heartbeat)
3. **Phase 8** — backend integration tests
4. **Phases 5-6** — frontend (types, API, dialog, badge)
5. **Phase 7** — firmware parsing
6. **Phase 9** — cleanup

## Chain Strategy

- **PR 1 → main**: Phases 1, 2, 3, 4, 8, 9 (~290 lines) — fits within 400-line budget
- **PR 2 → main** (after PR 1): Phases 5, 6 (~155 lines)
- **PR 3 → main** (after PR 2): Phase 7 (~25 lines)
