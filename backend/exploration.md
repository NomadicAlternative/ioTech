## Exploration: Phase 4 — Device SDK + WiFi Provisioning

### Executive Summary
Phase 4, as defined in the roadmap, combines two fundamentally different workstreams: backend API development and embedded systems (ESP32) development. This exploration recommends splitting them. We should proceed **now** with the **backend-only** portion: building the necessary APIs for device claiming, WiFi provisioning, and OTA update management. The ESP32 SDK should be a separate, subsequent project that consumes these APIs. This approach de-risks the project, allows for parallel work if resources permit, and lets the backend team build a complete, mock-testable service layer without needing physical hardware.

### Key Findings

1.  **Existing Device Auth is Weak:** Devices currently "authenticate" by publishing to an MQTT topic `devices/{deviceId}/telemetry`. The backend trusts the `deviceId` from the topic. A more secure `device_token` exists in the `devices` model but is only used by the `findByToken` lookup and not in the MQTT flow. This is a known technical debt that the new provisioning flow must address.

2.  **Clear Modular Structure:** The backend has a well-defined modular architecture in `backend/src/modules`. New endpoints for claiming, provisioning, and OTA updates can be cleanly integrated as new modules or extensions of the existing `devices` module.

3.  **No Existing Provisioning Logic:** The codebase has no concepts of device claiming, provisioning tokens, or OTA firmware management. These will be entirely new features.

4.  **MQTT Topic Structure is Telemetry-Only:** The current MQTT topic `devices/{deviceId}/telemetry` is hardcoded for data ingestion. A new, more secure topic structure will be needed for provisioning and other device-to-cloud commands.

### Recommended Scope Split

**Phase 4a: Backend Foundation (Build This Now)**

This phase focuses on creating all the server-side infrastructure. The deliverable is a set of secure, documented, and tested API endpoints that the future ESP32 SDK will use.

*   **1. Device Claiming Flow:**
    *   **Mechanism:** Implement a token-based claiming process.
    *   **API:** Create a new endpoint, likely `POST /api/v1/devices/claim`, where an authenticated installer can submit a short-lived `claim_token` to associate a device with one of their clients (`tenant_id`).
    *   **DB Changes:** Add `claim_token` (string, indexed), `claimed_at` (timestamp), and `status` (e.g., 'unclaimed', 'claimed', 'active') to the `devices` table.

*   **2. WiFi Provisioning Endpoint:**
    *   **Mechanism:** Create a new unauthenticated endpoint for the device to call during its initial setup.
    *   **API:** Create `POST /api/v1/provisioning`. The device will send its unique hardware ID and `claim_token`. The backend validates the token, marks the device as 'claimed', and returns the MQTT broker URL, the device's permanent `device_token`, and the `tenant_id`.
    *   **Security:** This is the critical step where the device trades a temporary `claim_token` for a permanent, secret `device_token`.

*   **3. Enhanced Device Security & Heartbeat:**
    *   **MQTT Auth:** The permanent `device_token` returned during provisioning should be used as the MQTT password for the device. The MQTT broker needs to be configured to authenticate clients against the `devices` table (username=`deviceId`, password=`device_token`).
    *   **Heartbeat:** Implement a `last_seen` timestamp column on the `devices` table, updated via a new MQTT topic like `org/{orgId}/device/{deviceId}/status`.

*   **4. OTA Update Foundation:**
    *   **Metadata API:** Create CRUD endpoints under `/api/v1/firmware` for managing firmware versions (e.g., version number, release notes, hardware compatibility).
    *   **Storage:** The API should return a pre-signed URL for firmware download. For now, this can point to a dummy location. The actual storage (S3, etc.) can be implemented later.
    *   **MQTT Topics:** Define topics for OTA commands, e.g., `org/{orgId}/device/{deviceId}/ota/notify`.

**Phase 4b: ESP32 SDK (Build Later)**

This is a separate project. It will be the consumer of the APIs built in Phase 4a.

*   Implement captive portal for WiFi credential entry.
*   Implement logic to call the `/api/v1/provisioning` endpoint.
*   Securely store the received `device_token` in device flash memory.
*   Use the `device_token` for all future MQTT connections.
*   Implement OTA update client logic.

### Risks

*   **MQTT Broker Configuration:** The plan to use the `device_token` as an MQTT password requires re-configuring the MQTT broker (EMQX) to use an external authentication data source (the PostgreSQL database). This can be complex.
*   **Hardware Simulation:** Without actual ESP32 hardware, testing the provisioning flow end-to-end will require building a mock client (e.g., a Node.js script) that simulates the device's behavior. This is feasible but adds overhead.

### Next Recommended Phase
Proceed with **Phase 4a: Backend Foundation**. The next step is to generate a formal `sdd-propose` for this narrowed scope.