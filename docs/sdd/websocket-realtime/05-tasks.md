# Tasks: WebSocket Real-Time Telemetry

## Phase 1: Foundation / Infrastructure
- [x] 1.1 Create `src/socket/socketMiddleware.js` with `createAuthMiddleware()`
- [x] 1.2 Create `src/socket/socketServer.js` with `initSocket`, tenant room, `subscribe:device`, `getSocketService()`
- [x] 1.3 Extract `verifyToken()` pure function from `authGuard.js`
- [x] 1.4 Modify `src/index.js`: `http.createServer`, `initSocket` (not in tests), inject socketService

## Phase 2: Core Implementation
- [x] 2.1 JWT handshake middleware wired into initSocket
- [x] 2.2 `subscribe:device` with DB ownership validation
- [x] 2.3 `emitTelemetry()` → `telemetry:new { id, deviceId, data, receivedAt }`
- [x] 2.4 `mqttClient.js` calls `socketService.emitTelemetry()` post-persist

## Phase 3: Integration / Wiring
- [x] 3.1 DI wired: socketService injected via index.js into initMqtt
- [x] 3.2 Docs/comments in all new/changed files

## Phase 4: Testing (TDD)
- [x] 4.1 `socketMiddleware.test.js` — 4 tests (valid, missing, expired, invalid JWT)
- [x] 4.2 `socketServer.test.js` — 8 tests (auth, rooms, subscribe, emit)
- [x] 4.3 `mqttClient.test.js` — 3 tests (emit called, not called on error, not called without service)
- [ ] 4.4 (Optional) Integration test MQTT → DB → WS — deferred
