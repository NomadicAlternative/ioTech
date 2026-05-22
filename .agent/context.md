# ioTech — Agent Context

## Project

ioTech is a B2B2C SaaS IoT platform for installers (electricians, integrators, technicians) who deploy smart devices (ESP32, ESP32-C3, ESP32-S3) for their clients.

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

- **Mac IP**: 192.168.18.79 (DHCP dinámico) | **ESP32 IP**: 192.168.18.81 (DHCP dinámico)
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

1. ~~Verificar telemetría DHT22 con auto-detect en firmware~~ ✅
2. ~~Super admin panel~~ ✅ — 3 PRs stacked, 25 tareas, 82 tests, migración 017 en DB
3. **Integración de pago** — Stripe/MercadoPago
4. **Firmware genérico** — io_driver architecture modular
5. **Completar i18n** — DE, PT, FR, IT para toda la app
6. **Email en producción** — Resend SDK listo, falta verificar dominio o configurar SMTP (App Password de Gmail)

## Últimos cambios (2026-05-22)

### Revert io_driver — firmware vuelve a estado funcional
- **Commit**: e7a66b9 — revert de 6ac7d8b (io_driver modular architecture)
- **Motivo**: relay_controller shim vacío (GPIOs sin configurar), drivers registrados pero nunca activados, command dispatch siempre DRV_ERR_NOT_FOUND
- **Resultado**: firmware compila OK (Flash 99.1%, RAM 11.4%), flash & provision wizard funcional
- **Backend schema**: cambios de 3c78210 y cdb3486 son backward-compatible (campos optional), se dejaron

### Fix MQTT — backend no recibía heartbeats
- **Causa**: mosquitto escucha solo IPv4, pero Node.js resuelve `localhost` a IPv6 `::1` primero → `mqtt.connect()` fallaba silenciosamente
- **Fix**: cambiar `MQTT_BROKER_URL=mqtt://localhost:1883` → `mqtt://127.0.0.1:1883` en .env
- **Dependencia faltante**: `express-rate-limit` no instalado (de f1331d4), impedía reiniciar backend
- **Resultado**: DHT22 device online, heartbeats recibidos, lastSeen actualizado

## Últimos cambios (2026-05-16)

### Super Admin Panel — COMPLETO
- **PR 1**: DB migration 017 (user_role ENUM, trial columns), superAdmin dual-check, trialExpiry middleware
- **PR 2**: Admin backend — GET /dashboard (KPIs), GET /tenants/:id (drill-down), POST createTenant (auto-trial)
- **PR 3**: Frontend admin — authStore role-based, AppShell mutex nav, DashboardPage (KPI cards), TenantsPage (cards expandibles con credenciales y clientes), InstallerDetailPage
- **Total**: 25 tareas, 82 tests nuevos, 502 backend + 200 frontend tests

### Funcionalidades adicionales
- **Delete tenant**: confirmación con escritura de "ELIMINAR", cascada total (usuarios, dispositivos, clientes, dashboards, reglas, telemetría)
- **Reset/generar contraseña**: super admin genera nueva pass para cualquier installer desde TenantsPage, se persiste en DB
- **Change password**: usuarios cambian su contraseña desde Settings page
- **Forgot password**: flujo de recuperación con email (Resend SDK listo, SMTP pendiente para producción)
- **Diseño TenantsPage**: cards azules con gradiente, badges de status (verde/ámbar/rojo), avatares por iniciales, expandibles con credenciales y clientes

### Bugs corregidos
- `is_active` → `status: 'active'` en admin dashboard query
- Migración 017: `DROP DEFAULT` antes de `ALTER TYPE` para ENUM de PostgreSQL
- Seed de admin: UPSERT reemplazado por UPDATE-existing + INSERT-new

### Activo ahora
- **Dispositivo DHT22**: `15268547-9d2d-4033-8a1e-c2d3d1f73a44` (Control de temperatura con DHT22 y relé), template `e47524c1`, installer `test@instalador.com`
- **Dashboard activo**: `temphumedad` (f4f91fb9), muestra temperatura y humedad en tiempo real
- **Serial port**: `/dev/cu.usbserial-110`

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
- Never commit secrets
- Modular code — single responsibility per file
- Validate all inputs with Joi schemas
- Multi-tenant via RLS — always use `withTenant()`
- Conventional commits only
- Save session summary to engram AND .agent/context.md at end of every session
- ⚠️ engram MCP: session summary se guarda bajo el proyecto del working directory al iniciar opencode. Para que quede en "iotech", abrí opencode DESDE /Users/diegogarcia/Desktop/IoTech/ioTech/
- No flashear firmware sin ESP32 conectado

## Driver Roadmap (io_driver RESTAURADO con fixes — 2026-05-22)

El refactor io_driver (6ac7d8b) fue revertido (e7a66b9) y luego restaurado con fixes:
- io_driver_load_all_defaults(): activa DHT22, RELAY, LCD1602_I2C sin NVS
- Stack heartbeat: 2048 → 8192 (previene overflow con múltiples sensores)
- Factory reset: GPIO 0 → 14 (evita falso trigger por DTR/RTS)
- Catálogo en BD con 32 drivers, API pública GET /api/drivers/catalog

**Fase 1 — Compilados (10 drivers)**:
DHT22, RELAY, BME280, DS18B20, PIR, HC-SR04, WS2812B, SERVO, SSD1306, LCD1602_I2C

**Defaults activos**: DHT22 (GPIO 32), RELAY (7CH), LCD1602_I2C (0x27)

**Recordatorio por sesión**: los 9 drivers compilan para las 4 targets pero NINGUNO fue probado con hardware real. Ver lista de compras en memoria Engram (`sdd/io-driver/hardware-validation`).

**Fase 2 — Cuando haya hardware físico**:
SHT30/31, CCS811, SGP30, PMS5003, BH1750, INA219, stepper 28BYJ-48, ST7735, ST7789, ILI9341, RFID RC522, Modbus RTU, RS485

**Fase 3 — Crecimiento**:
LoRa (SX1276/78/1262), ESP32-S3/C3/C6/H2, Zigbee/Thread, ePaper, cámara OV2640, MPU6050, VL53L0X, keypad, microSD, deep sleep, battery telemetry
- Puerto serial se auto-detecta (ls /dev/cu.usbserial-*)
- Catálogo completo: 32 drivers en BD → GET /api/drivers/catalog
