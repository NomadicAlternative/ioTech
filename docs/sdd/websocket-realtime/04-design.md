# Design: Real-Time Telemetry via WebSockets

## Technical Approach

Attach Socket.io to HTTP server (`http.createServer(app)` in `index.js`). JWT auth middleware validates handshake, joins socket to `tenant:<tenantId>`. MQTT pipeline emits `telemetry:new` post-persist via DI pattern.

## Architecture Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Integration point | `index.js` via `http.createServer(app)` | Keeps `app.js` clean for supertest |
| 2 | Module location | `src/socket/` (mirrors `src/mqtt/`) | Infrastructure, not shared middleware |
| 3 | Emit point | `mqttClient.js` after ingest resolves | Keeps telemetry.service pure |
| 4 | Auth strategy | Extract `verifyToken()` from `authGuard.js` | Single source of truth for JWT |
| 5 | Room strategy | Auto-join `tenant:<id>` + `device:<id>` on subscribe | Enables future tenant-wide broadcasts |
| 6 | Rate-limit subscribe:device | DEFERRED | Few devices per installer |
| 7 | row.id in payload | YES — `{ id, deviceId, data, receivedAt }` | Enables client-side dedup |

## Data Flow

```
MQTT Broker → mqttClient.js → telemetryService.ingest() → DB insert → row
                                                                         ↓
                                            socketService.emitTelemetry(row)
                                                                         ↓
                                    io.to(tenant).to(device).emit('telemetry:new', payload)
                                                                         ↓
                                                              Connected clients
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/socket/socketServer.js` | Create | Init, rooms, emitTelemetry, subscribe:device |
| `src/socket/socketMiddleware.js` | Create | JWT auth middleware for WS |
| `src/shared/middleware/authGuard.js` | Modify | Extract verifyToken() |
| `src/mqtt/mqttClient.js` | Modify | Accept socketService, call emit post-persist |
| `src/index.js` | Modify | http.createServer, initSocket, DI |
