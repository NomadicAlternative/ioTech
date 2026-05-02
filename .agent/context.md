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
- 9 MVP widgets: Gauge, Number Display, Line Chart, Status Indicator, Toggle Switch, Button, Stat Card, Progress Bar, Map
- Grid drag/resize con react-grid-layout
- Config panel: device selector → datastream selector → type-specific settings
- Auto-save con debounce 1500ms
- Sharing dashboard con clientes
- Socket.io → telemetryStore → widgets reactivos

### Phase 5 — Runtime fixes (branch: feat/dashboard-editor — PR #27 abierto)
Fixes aplicados en esta sesión:

- **Grid layout**: `WidthProvider` → `ResizeObserver` con `useLayoutEffect` + `width` explícito pasado al `ResponsiveGridLayout`. Aplica en editor y view.
- **Editor fullscreen**: `-m-6` en root div del editor para escapar `p-6` del AppShell + `overflow-hidden`
- **Auto-save**: sanitizar `y: Infinity → 0` antes de enviar al backend — Joi rechaza non-integer en `y: integer().min(0)`
- **ToggleSwitchWidget**: reemplazado `optimistic` (se reseteaba a null) por `localState` persistente + `pending` para bloquear doble-click. Telemetría toma prioridad si llega.
- **Duplicate widget**: botón en WidgetConfigPanel — busca `maxRelay` en todo el layout y hace `maxRelay + 1`. Evita duplicados sin importar desde qué widget se duplica.
- **Invalid Date**: guard `updatedAt ? ... : '—'` en DashboardListPage

### Branch: feat/relay-control (PR #25 — PENDIENTE DE MERGE)
- Relés 1-7 funcionando físicamente
- Firmware: keepalive 60s, heartbeat 30s, disable_clean_session
- Backend heartbeat timeout: 90s (era 60s)
- Contrato MQTT: `{ type:"relay", relay:number, state:"on"|"off" }`

## Key Runtime Config

- **Mac IP**: 192.168.18.58 | **ESP32 IP**: 192.168.18.65
- **Device Access-001**: id=8bb9c9c7-19c9-4682-a9b7-8e217d388cd8, tenant_id=216bfcbf-e88f-4ea3-b46a-550db49af2ed
- **DB**: postgresql://diegogarcia@localhost:5432/iotech_dev
- **Backend**: `cd backend && node src/index.js` (port 3000)
- **Frontend**: port 5173
- **Miniterm**: `python3 -m serial.tools.miniterm --dtr 0 --rts 0 /dev/cu.usbserial-10 115200`
- **Flash port**: /dev/cu.usbserial-10
- **GPIO map**: relay1→23, relay2→22, relay3→21, relay4→19, relay5→18, relay6→5, relay7→17 (active LOW)
- **Paleta**: `--brand-imperial:#01295F`, `--brand-cerulean:#437F97`, `--brand-olive:#849324`, `--brand-amber:#FFB30F`, `--brand-red:#FD151B`
- **Cookie**: `refreshToken`, httpOnly, sameSite lax, maxAge 7d
- **Socket event**: `telemetry:new` (socketServer.js line 73)
- **Relay state**: string `"on"|"off"` — NO boolean

## Next Steps

1. **Mobile (punto 4)** — responsive view mode en celular, ajustar grid
2. **Merge PR #25** — feat/relay-control (firmware + heartbeat)
3. **Merge PR #27** — feat/dashboard-editor (todos los fixes de esta sesión)

## API Overview

All list endpoints return `{ data: [...], meta: { page, limit, total, totalPages } }`.
All errors return `{ error: { code, message, status, details? } }`.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/login | No | Login → sets refreshToken cookie |
| POST | /api/auth/refresh | No | Refresh via cookie |
| POST | /api/auth/logout | No | Logout + clear cookie |
| GET | /api/devices | Yes | List devices |
| POST | /api/devices/:id/command | Yes | Send relay command via MQTT |
| GET | /api/device-templates/:id | Yes | Get template + datastreams |
| GET | /api/dashboards | Yes | List dashboards |
| POST | /api/dashboards | Yes | Create dashboard |
| GET | /api/dashboards/:id | Yes | Get dashboard + layout |
| PUT | /api/dashboards/:id/layout | Yes | Save layout JSON |
| POST | /api/dashboards/:id/share | Yes | Share with client |
| DELETE | /api/dashboards/:id/share/:clientId | Yes | Revoke share |

## Rules

- Siempre dar el comando completo, nunca solo flags
- Never commit secrets
- Modular code — single responsibility per file
- Validate all inputs with Joi schemas
- Multi-tenant via RLS — always use `withTenant()`
- Conventional commits only
- Save session summary to engram AND .agent/context.md at end of every session
