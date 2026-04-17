# WebSocket Real-Time Telemetry — Specifications

## WebSocket Service (New Domain)

### WS-1: Server Initialization
Socket.io server MUST attach to the existing HTTP server on startup.

### WS-2: JWT Authentication on Handshake
Every connection MUST be authenticated via JWT in `handshake.auth.token`. Invalid/missing → reject + disconnect.

**Scenarios**: Valid JWT accepted | Missing token rejected | Expired token rejected | Invalid token rejected

### WS-3: Tenant Room Isolation
On auth success, auto-join `tenant:<tenantId>`. No cross-tenant events.

### WS-4: Device Subscription
Client emits `subscribe:device` with `deviceId`. Server validates tenant ownership. Invalid → silent drop.

**Scenarios**: Valid device → join room | Foreign device → no join

### WS-5: Telemetry Emission
`emitTelemetry()` emits `telemetry:new` to subscribed sockets. Fire-and-forget.

**Scenarios**: Broadcast to subscribers | No subscribers → no error

---

## Delta: Auth Service (AUTH-EXT-1)
Expose `verifyToken(token)` for reuse by WS middleware.

## Delta: MQTT Handler (MQTT-EMIT-1)
After persist, call `emitTelemetry()`. On persist failure, do NOT emit.
