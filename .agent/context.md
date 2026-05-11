# ioTech — Agent Context

## Project

ioTech is a B2B2C SaaS IoT platform for installers (electricians, integrators, technicians) who deploy smart devices (ESP32, ESP8266, Raspberry Pi) for their clients.

**Model**: Installer -> Client -> Devices
**Revenue**: Subscription per device, per installer, future white-label
**Repo**: github.com/NomadicAlternative/ioTech

## Architecture

```
Devices -> MQTT -> Backend (Node.js/Express) -> PostgreSQL (RLS) -> WebSocket -> Dashboard -> Widgets
```

### MQTT Protocol

| Topic                          | Direction | Description          |
|--------------------------------|-----------|----------------------|
| `devices/{deviceId}/telemetry` | Device->Server | Telemetry ingestion |
| `devices/{deviceId}/command`   | Server->Device | Commands (relay, etc.) |

## Tech Stack

- **Runtime**: Node.js (CommonJS)
- **Framework**: Express 5
- **Database**: PostgreSQL with Knex.js, RLS for multi-tenancy
- **Auth**: JWT (access + refresh tokens), bcrypt — refresh token como httpOnly cookie
- **MQTT**: mqtt.js 5.x
- **WebSocket**: Socket.io (real-time telemetry)
- **Validation**: Joi (per-module schemas)
- **API Docs**: Swagger/OpenAPI 3.0 at `/api-docs`
- **Testing**: Jest, ESLint, Prettier
- **Config**: dotenv (.env)
- **Frontend**: React 19 + Vite + Tailwind 4 + Shadcn/ui + Zustand 5 + react-grid-layout + Recharts + Socket.io client + React Router 7 + Axios

## Project Structure

```
ioTech/
  backend/
    src/
      index.js
      app.js
      mqtt/mqttClient.js
      socket/socketServer.js         # emits 'telemetry:new' (line 73)
      shared/db/knex.js
      shared/db/tenant-knex.js       # withTenant() for RLS
      shared/errors.js
      shared/middleware/
      modules/
        auth/                        # httpOnly cookie refresh token
        devices/                     # CRUD + command endpoint
        device-templates/            # typed datastreams
        clients/
        dashboards/                  # CRUD + layout JSONB + sharing
        telemetry/
        firmware/
        provisioning/
  frontend/
    src/
      features/
        auth/                        # authStore: accessToken in memory
        dashboard/
          DashboardListPage.tsx       # fix: updatedAt nullable
          DashboardEditorPage.tsx     # fix: ResizeObserver + -m-6
          DashboardViewPage.tsx       # fix: ResizeObserver
          dashboardStore.ts           # fix: sanitize y:Infinity before save
          api.ts
        devices/
          DeviceDetailPage.tsx
          DeviceListPage.tsx
        widgets/
          WidgetRenderer.tsx
          WidgetConfigPanel.tsx       # Duplicate button con maxRelay+1
          registry.ts
          types/
            ToggleSwitchWidget.tsx    # fix: localState + pending
            ButtonWidget.tsx
            GaugeWidget.tsx
            ... (9 widgets total)
      stores/
        telemetryStore.ts            # flat key "deviceId:datastreamKey"
        widgetConfigStore.ts
      providers/SocketProvider.tsx   # telemetry:new → telemetryStore
      components/AppShell.tsx        # sidebar + main con p-6
  .agent/
    context.md
    dashboard-phase-6-archive.md
```

## Current State

### Phases 1–4c (COMPLETE) — ver historia completa en dashboard-phase-6-archive.md

### Phase 5 — Dashboard Web (COMPLETE — PR merged)
- 9 MVP widgets + grid drag/resize + auto-save + sharing + WebSocket reactivo

### Phase 6 — Automation & Rules (COMPLETE — PRs #30, #31, #32 merged)
- Rules engine con threshold/status triggers, relay/command actions, cooldown
- Frontend CRUD: RulesPage, RuleForm con campos condicionales

### Phase 7 — Installer Flow (COMPLETE — branch: feat/installer-backend)
- **PR #1**: POST /api/auth/installer-register, claim_token auto-gen, regenerate
- **PR #2**: Firmware frontend CRUD (features/firmware/)
- **PR #3**: Web Serial Provisioning UI (features/provisioning/ProvisioningPage, status filter)
- **PR #4**: Charging rules: charging_start/stop, low_power_mode, battery_low trigger
- **Flash Wizard**: POST /api/devices/:id/flash (SSE), FlashDeviceWizard, script flash-device.sh
- **Bugs**: JSON.stringify datastreams, findById, logoSrc, SSE parsing — todos fixeados
- **Manual**: docs/INSTALLER_ONBOARDING.md

## Key Runtime Config

- **Mac IP**: 192.168.18.58 | **ESP32 IP**: 192.168.18.65
- **Device Access-001**: id=8bb9c9c7-19c9-4682-a9b7-8e217d388cd8, tenant_id=216bfcbf-e88f-4ea3-b46a-550db49af2ed
- **DB**: postgresql://diegogarcia@localhost:5432/iotech_dev
- **Backend**: `cd backend && node src/index.js` (port 3000)
- **Frontend**: port 5173
- **Miniterm**: `python3 -m serial.tools.miniterm --dtr 0 --rts 0 /dev/cu.usbserial-110 115200`
- **Flash port**: /dev/cu.usbserial-110 (auto-detectado)
- **Flash script**: `./scripts/flash-device.sh <DEVICE_ID>`
- **GPIO map**: relay1→23, relay2→22, relay3→21, relay4→19, relay5→18, relay6→5, relay7→17 (active LOW)
- **Paleta**: `--brand-imperial:#01295F`, `--brand-cerulean:#437F97`, `--brand-olive:#849324`, `--brand-amber:#FFB30F`, `--brand-red:#FD151B`
- **Cookie**: `refreshToken`, httpOnly, sameSite lax, maxAge 7d
- **Socket event**: `telemetry:new` (socketServer.js line 73)
- **Relay state**: string `"on"|"off"` — NO boolean

### Firmware OTA (ARCHIVED — 3 stacked PRs, `docs/sdd/archive/2026-05-11-firmware-ota/`)
- **PR 1** (merged, commits on main): Phases 1-4, 8, 9 — DB migration, backend check/trigger/heartbeat endpoints, integration tests
- **PR 2** (merged, commits on main): Phases 5-6 — Device firmware type, firmwareApi, OtaUpdateDialog, version badge + button
- **PR 3** (merged, commits on main): Phase 7 — Parse OTA notify JSON in mqtt_manager.c, extract version+url, call ota_manager_set_url() before triggering SM_EVT_OTA_NOTIFY
- **Verify**: 112 tests passing (84 backend, 28 frontend), 37/37 spec scenarios compliant
- **Archived**: `2026-05-11` → `docs/sdd/archive/2026-05-11-firmware-ota/`

## Next Steps

1. **OTA follow-up: OTA button hidden when firmwareVersion is null** — verificar si el botón OTA se oculta correctamente cuando device.firmwareVersion es null (sugerencia del verify report)
2. **OTA follow-up: hardwareModel from template** — verificar que hardwareModel se deriva del campo DB `hardware_model`, no de `template.name` (sugerencia del verify report)
3. **Firmware file upload** — upload de binarios (hoy es URL externa)
4. **Installer UI registration** — formulario de registro en el frontend

## API Overview

All list endpoints return `{ data: [...], meta: { page, limit, total, totalPages } }`.
All errors return `{ error: { code, message, status, details? } }`.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/login | No | Login → sets refreshToken cookie |
| POST | /api/auth/refresh | No | Refresh via cookie |
| POST | /api/auth/logout | No | Logout + clear cookie |
| POST | /api/auth/installer-register | No | Register installer (tenant + user) ← NUEVO |
| GET | /api/devices | Yes | List devices (query: ?status=unclaimed) |
| POST | /api/devices | Yes | Create device (auto-genera claim_token) |
| POST | /api/devices/:id/command | Yes | Send relay command via MQTT |
| POST | /api/devices/:id/regenerate-claim-token | Yes | Regenerate claim token ← NUEVO |
| POST | /api/devices/:id/flash | Yes | Flash firmware via SSE ← NUEVO |
| GET | /api/devices/:id/provisioning-credentials | Yes | Get credentials for serial provisioning |
| GET | /api/device-templates/:id | Yes | Get template + datastreams |
| GET | /api/firmware | Yes | List firmware versions |
| GET | /api/firmware/check | No | Check latest firmware by hardware_model ← NUEVO (OTA) |
| POST | /api/firmware | Yes | Create firmware version |
| POST | /api/devices/:id/ota | Yes | Trigger OTA firmware update ← NUEVO (OTA) |
| GET | /api/dashboards | Yes | List dashboards |
| POST | /api/dashboards | Yes | Create dashboard |
| PUT | /api/dashboards/:id/layout | Yes | Save layout JSON |

## Rules

- Siempre dar el comando completo, nunca solo flags
- Never commit secrets
- Modular code — single responsibility per file
- Validate all inputs with Joi schemas
- Multi-tenant via RLS — always use `withTenant()`
- Conventional commits only
- Save session summary to engram AND .agent/context.md at end of every session
- No flashear firmware sin ESP32 conectado
- Puerto serial se auto-detecta (ls /dev/cu.usbserial-*)
