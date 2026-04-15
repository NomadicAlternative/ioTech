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

- **Runtime**: Node.js (CommonJS)
- **Framework**: Express 5
- **MQTT**: mqtt.js 5.x
- **Database**: PostgreSQL (planned, not yet integrated)
- **Config**: dotenv (.env)

## Project Structure

```
ioTech/
  backend/                  # <-- ACTIVE CODE LIVES HERE
    src/
      index.js              # Express server + MQTT init + health endpoint
      config/
        mqtt.js             # Centralized MQTT config from env vars
      mqtt/
        mqttClient.js       # MQTT client: subscribe, deviceId extraction, JSON parsing
    package.json            # iotech-backend deps
  .env.example              # Environment template
  .gitignore
  README.md
  .agent/
    context.md              # This file
```

> **Note**: Root-level `src/`, `config/mqtt.js`, and root `package.json` are legacy scaffolding with empty files. Pending cleanup decision.

## Current State

### Phase 1 — MQTT Ingestion (COMPLETE)

- MQTT broker connection with auto-reconnect
- Subscription to `devices/+/telemetry`
- deviceId extraction from topic via regex
- Safe JSON parsing with structured error handling
- Structured telemetry object: `{ deviceId, data, receivedAt }`
- Health endpoint: `GET /health` (includes MQTT connection status)
- Debug mode: `MQTT_DEBUG=true` for packet logging

### Phase 2 — Database + Device Registry (CURRENT GOAL)

- [ ] PostgreSQL integration
- [ ] Core tables: installers, customers, devices, telemetry
- [ ] Device registry
- [ ] API endpoints (CRUD)
- [ ] Telemetry data persistence

### Future Phases

- Dashboard builder
- Widget library (customizable per client)
- Automation rules engine
- Device command system (`devices/{id}/command`)

## Rules

- Use `.env` for all secrets — never commit secrets
- Modular code — single responsibility per file
- Validate all inputs
- Think multi-tenant from day one
- Conventional commits only
