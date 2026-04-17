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
| `devices/{deviceId}/command`   | Server->Device | Commands (future)    |

## Tech Stack

- **Runtime**: Node.js (CommonJS)
- **Framework**: Express 5
- **Database**: PostgreSQL with Knex.js, RLS for multi-tenancy
- **Auth**: JWT (access + refresh tokens), bcrypt
- **MQTT**: mqtt.js 5.x
- **WebSocket**: Socket.io (real-time telemetry)
- **Validation**: Joi (per-module schemas)
- **API Docs**: Swagger/OpenAPI 3.0 at `/api-docs`
- **Testing**: Jest (142 tests), ESLint, Prettier
- **Config**: dotenv (.env)

## Project Structure

```
ioTech/
  backend/
    src/
      index.js                    # Express server + MQTT init
      app.js                      # Express app factory, mounts routers + Swagger
      config/
        mqtt.js                   # MQTT config from env vars
        swagger.js                # OpenAPI 3.0 config
      mqtt/
        mqttClient.js             # MQTT client with DI for telemetry service
      socket/
        socketServer.js           # Socket.io real-time telemetry layer
      shared/
        db/
          knex.js                 # Singleton Knex instance
          tenant-knex.js          # withTenant() for RLS enforcement
        errors.js                 # AppError, NotFoundError, ValidationError (with details[])
        middleware/
          authGuard.js            # JWT verification
          tenantResolver.js       # Sets tenant context from JWT
          errorHandler.js         # Centralized error envelope
          validate.js             # Joi validation middleware factory
          paginate.js             # Pagination/sorting middleware
      modules/
        auth/                     # register, login, refresh, logout
        devices/                  # CRUD + device auth + paginated list
        device-templates/         # CRUD + typed datastreams
        clients/                  # CRUD + paginated list
        installers/               # list, get, update + paginated
        telemetry/                # query endpoint + MQTT ingestion
    package.json
  .env.example
  .agent/
    context.md                    # This file
```

## Current State

### Phase 1 — MQTT Ingestion (COMPLETE)
- MQTT broker connection with auto-reconnect
- Subscription to `devices/+/telemetry`
- deviceId extraction from topic via regex
- Structured telemetry object: `{ deviceId, data, receivedAt }`
- Health endpoint: `GET /health`

### Phase 2 — Foundation (COMPLETE — PR #1)
- PostgreSQL with Knex.js (8 migrations)
- JWT auth (access + refresh tokens, bcrypt)
- RLS multi-tenancy via `withTenant()`
- 6 modular domains: auth, devices, device-templates, clients, installers, telemetry
- 36 tests passing

### Phase 3a — Typed Datastreams (COMPLETE — PR #2)
- Device templates with typed datastream definitions
- Telemetry validation against template schemas

### Phase 3b — WebSocket Real-time (COMPLETE — PR #3)
- Socket.io layer for real-time telemetry push to dashboards

### Phase 3c — REST API Hardening (COMPLETE — PR #4)
- Joi-based input validation on all POST/PUT endpoints (per-module schemas)
- Pagination, filtering, sorting on all list endpoints (`{ data, meta }`)
- Standardized error envelope (`{ error: { code, message, status, details? } }`)
- Swagger/OpenAPI 3.0 docs at `/api-docs` (no auth required)
- 142 tests, 0 ESLint errors

### Phase 4a — Device Backend Foundation (NEXT — SDD planning complete)
Split from original Phase 4. Backend-only APIs that future ESP32 SDK will consume.
SDD artifacts in engram (project: iotech):
- Exploration: #155 (sdd/phase4-device-sdk/explore)
- Proposal: #156 (sdd/phase4a-device-backend/proposal)
- Spec: #157 (sdd/phase4a-device-backend/spec) — 8 requirements, 21 scenarios
- Design: #158 (sdd/phase4a-device-backend/design) — 7 architecture decisions
- Tasks: #159 (sdd/phase4a-device-backend/tasks) — 31 tasks in 7 phases

Scope:
- Device claiming flow (token-based, atomic UPDATE...RETURNING)
- WiFi provisioning endpoint (unauthenticated, rate-limited)
- MQTT device auth via EMQX HTTP callback
- Heartbeat + online/offline tracking + Socket.io events
- OTA firmware metadata CRUD + MQTT notify
- Device simulator CLI (tools/device-simulator.js)

### Phase 4b — ESP32 SDK (FUTURE)
- Captive portal for WiFi config
- C/Arduino SDK consuming Phase 4a APIs
- Secure token storage in flash
- OTA update client

### Future Phases
- Phase 5: Dashboard web (React, widget system, real-time via WebSocket)
- Phase 6: Automation & rules engine (if temp > X then action Y)
- Phase 7: Production hardening (EMQX broker auth, rate limiting, CI/CD)
- Phase 8: Mobile app for installers

## API Overview

All list endpoints return `{ data: [...], meta: { page, limit, total, totalPages } }`.
All errors return `{ error: { code, message, status, details? } }`.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | No | Register installer |
| POST | /api/auth/login | No | Login |
| POST | /api/auth/refresh | No | Refresh token |
| POST | /api/auth/logout | No | Logout |
| GET | /api/devices | Yes | List devices (paginated) |
| POST | /api/devices | Yes | Create device |
| GET | /api/devices/:id | Yes | Get device |
| PUT | /api/devices/:id | Yes | Update device |
| DELETE | /api/devices/:id | Yes | Delete device |
| POST | /api/devices/:id/authenticate | Yes | Authenticate device |
| GET | /api/device-templates | Yes | List templates (paginated) |
| POST | /api/device-templates | Yes | Create template |
| GET | /api/device-templates/:id | Yes | Get template |
| PUT | /api/device-templates/:id | Yes | Update template |
| DELETE | /api/device-templates/:id | Yes | Delete template |
| GET | /api/clients | Yes | List clients (paginated) |
| POST | /api/clients | Yes | Create client |
| GET | /api/clients/:id | Yes | Get client |
| PUT | /api/clients/:id | Yes | Update client |
| DELETE | /api/clients/:id | Yes | Delete client |
| GET | /api/installers | Yes | List installers (paginated) |
| GET | /api/installers/:id | Yes | Get installer |
| PUT | /api/installers/:id | Yes | Update installer |
| GET | /api/devices/:deviceId/telemetry | Yes | Query telemetry (paginated) |
| GET | /api-docs | No | Swagger UI |

## Rules

- Use `.env` for all secrets — never commit secrets
- Modular code — single responsibility per file
- Validate all inputs with Joi schemas
- Multi-tenant via RLS — always use `withTenant()`
- Conventional commits only
- Strict TDD — tests first
