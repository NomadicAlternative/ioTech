# Exploration: WebSocket Real-time Telemetry

**What**: Explored options for implementing real-time functionality using WebSockets and designed an architecture to bridge MQTT telemetry data to dashboard clients.

**Why**: The ioTech platform needs to display device telemetry in real-time to users.

**Areas Analyzed**:
- `src/index.js`: Express server startup (app.listen)
- `src/mqtt/mqttClient.js`: MQTT telemetry entry point
- `src/modules/telemetry/telemetry.service.js`: ingest function (validate + persist)
- `src/shared/middleware/authGuard.js`: JWT validation logic

**Key Findings**:
- Current server uses `app.listen()` — needs explicit `http.createServer(app)` for Socket.io
- `telemetryService.ingest()` is the ideal hook point for WS emission (post-validation, post-persist)
- **Socket.io chosen over ws** — built-in rooms (multi-tenant), auth middleware, auto-reconnect, broadcasting
- Design: JWT auth on handshake, tenant rooms (`tenant:<id>`), device rooms (`device:<id>`), fire-and-forget emit
