# Proposal: Real-Time Telemetry via WebSockets

## Intent

Push telemetry data over WebSockets to dashboard clients in real-time, eliminating polling.

## Scope

### In Scope
- Integrate Socket.io with the existing Express application
- JWT-based authentication for WebSocket connections
- Tenant-specific rooms for data isolation
- Device-level subscriptions
- MQTT → persist → emit bridge

### Out of Scope
- Client-side dashboard implementation
- Replaying historical data over WebSockets
- Commands from client to device (Change 6)
- Message delivery guarantees (fire-and-forget)

## Approach

Socket.io attached to Express HTTP server. JWT middleware validates handshake, auto-joins tenant room. Clients subscribe to specific devices. MQTT handler emits post-persist.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Connection flood | Medium | Auth gate prevents unauthenticated resource consumption |
| Security in WS auth | Low | Reuse existing JWT validation logic |
| Scalability | Medium | Single server initially; Redis adapter deferred |

## Rollback

Comment out `initSocket()` in `index.js` and emit call in `mqttClient.js`. Fully additive change.
