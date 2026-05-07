# ioTech — Agent Context

## Project

ioTech is a B2B2C SaaS IoT platform for installers (electricians, integrators, technicians) who deploy smart devices (ESP32, ESP8266, Raspberry Pi) for their clients.

**Model**: Installer -> Client -> Devices
**Revenue**: Subscription per device, per installer, future white-label

## Architecture

```
Devices -> MQTT -> Backend (Node.js/Express) -> Database (PostgreSQL) -> Dashboard -> Widgets
```

### MQTT Protocol

| Topic                          | Direction | Description          |
|--------------------------------|-----------|----------------------|
| `devices/{deviceId}/telemetry` | Device->Server | Telemetry ingestion |
| `devices/{deviceId}/command`   | Server->Device | Commands (future)    |

## Tech Stack

### Backend
- **Runtime**: Node.js (CommonJS)
- **Framework**: Express 5
- **MQTT**: mqtt.js 5.x
- **Database**: PostgreSQL (via Knex)
- **Config**: dotenv (.env)
- **Auth**: JWT + bcrypt
- **Validation**: Joi

### Frontend
- **Framework**: React 19
- **Build**: Vite 6
- **Language**: TypeScript 5
- **Routing**: react-router-dom 7
- **Testing**: Vitest + @testing-library/react
- **Serial**: Web Serial API (Chrome/Edge only)

## Project Structure

```
ioTech/
  backend/
    src/
      index.js              # Express server + MQTT init + health endpoint
      app.js                # Express app factory (tests import this)
      config/
        mqtt.js             # Centralized MQTT config from env vars
      modules/
        devices/            # Device registry + provisioning API
          devices.model.js  # Data access (knex queries)
          devices.service.js # Business logic + camelization
          devices.routes.js # REST endpoints: CRUD + provisioning-credentials
          __tests__/
            devices.service.test.js
        auth/               # Registration, login, JWT, refresh tokens
        clients/            # Client management
        device-templates/   # Device template definitions
        installers/         # Installer/tenant admin
        rules/              # Automation rules engine
        telemetry/          # Telemetry ingestion + queries
      mqtt/
        mqttClient.js       # MQTT client: subscribe, deviceId extraction, JSON parsing
      shared/
        db/                 # Knex instance, migrations, seeds, tenant-knex helper
        middleware/          # authGuard, tenantResolver, errorHandler
        errors.js           # AppError, NotFoundError, ValidationError, etc.
        logger.js           # Structured console logger
        validators.js       # Email, password, UUID validators
    package.json            # iotech-backend deps
    knexfile.js             # Knex CLI config
    jest.config.js          # Jest config (clearMocks: true)
  frontend/
    src/
      features/
        devices/
          api.ts            # Device API types + fetch helpers
        provisioning/
          ProvisioningPage.tsx       # Unclaimed devices list + provision button
          hooks.ts                   # useUnclaimedDevices, useProvisioningCredentials
          components/
            ProvisioningModal.tsx     # Web Serial connection + credential send UI
          __tests__/
            ProvisioningPage.test.tsx # Mocked Web Serial + all states
        rules/
          RuleForm.tsx       # Rule creation/editing form
          rulesApi.ts        # Rule API types
          __tests__/
            RuleForm.test.tsx
      components/
        AppShell.tsx         # Sidebar + nav layout
      App.tsx                # Router setup
      main.tsx               # React entry point
      test/
        setup.ts             # @testing-library/jest-dom
        jest-compat.ts       # jest → vi shim for vitest
    package.json
    vite.config.ts
    vitest.config.ts
    tsconfig.json
  .env.example
  .gitignore
  README.md
  .agent/
    context.md              # This file
```

## Current State

### Phase 1 — MQTT Ingestion (COMPLETE)

- MQTT broker connection with auto-reconnect
- Subscription to `devices/+/telemetry`
- deviceId extraction from topic via regex
- Safe JSON parsing with structured error handling
- Structured telemetry object: `{ deviceId, data, receivedAt }`
- Health endpoint: `GET /health` (includes MQTT connection status)
- Debug mode: `MQTT_DEBUG=true` for packet logging

### Phase 2 — Database + Device Registry (COMPLETE)

- ✅ PostgreSQL integration with Knex
- ✅ Core tables: tenants, users, devices, device_templates, telemetry, clients, refresh_tokens
- ✅ Row Level Security (RLS) on all tenant-scoped tables
- ✅ Device CRUD API endpoints with tenant scoping
- ✅ Telemetry data persistence + queries
- ✅ JWT auth + refresh token rotation
- ✅ Installer/tenant admin routes
- ✅ Client management

### Phase 3 — Device Provisioning (CURRENT)

- ✅ GET /api/devices?status=unclaimed — status filter on device list
- ✅ claimToken + hardwareId exposed in device responses (camelized)
- ✅ GET /api/devices/:id/provisioning-credentials — provisioning endpoint
- ✅ claim_token + hardware_id columns in devices table (migration 009)
- ✅ Frontend: ProvisioningPage with unclaimed device list
- ✅ Frontend: ProvisioningModal with Web Serial API (send credentials via serial)
- ✅ Frontend: Unsupported browser fallback (non-Chrome/Edge)
- ✅ Frontend: /app/provision route + sidebar nav item
- ✅ Frontend tests: all states (loading, error, empty, list, modal, serial flow)
- ✅ Backend tests: list() status filter, camelization, getProvisioningCredentials

### Future Phases

- Dashboard builder
- Widget library (customizable per client)
- Automation rules engine
- Device command system (`devices/{id}/command`)

## Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| POST | /api/auth/register | Register user |
| POST | /api/auth/login | Login (returns JWT + refresh token) |
| POST | /api/auth/refresh | Refresh JWT |
| POST | /api/auth/logout | Invalidate refresh token |
| GET | /api/devices | List devices (optional ?status= filter) |
| GET | /api/devices/:id | Get device by ID |
| POST | /api/devices | Create device |
| PUT | /api/devices/:id | Update device |
| DELETE | /api/devices/:id | Delete device |
| POST | /api/devices/:id/authenticate | Device self-auth via device_token |
| GET | /api/devices/:id/provisioning-credentials | Get claim token + hardware ID |

## Rules

- Use `.env` for all secrets — never commit secrets
- Modular code — single responsibility per file
- Validate all inputs
- Think multi-tenant from day one
- Conventional commits only
