# Proposal: Installer Flow

## Intent

Enable installers to self-register, manage firmware, provision devices via Web Serial, and automate power-management rules — replacing admin-dependent flows with an end-to-end self-service experience.

## Scope

### In Scope (4 chained PRs)

#### PR #1 — Installer Backend + Claim Tokens
- `POST /api/auth/installer-register` — creates tenant + user + logs in (single transaction)
- Auto-generate `claim_token` (uuidv4) on device creation
- `POST /api/devices/:id/regenerate-claim-token`
- Migration 015: add `contact_email` + `metadata` columns to tenants (fixes existing installers bug)
- Backend tests (~35)

#### PR #2 — Firmware Frontend CRUD
- New `features/firmware/` — list page, form (create/edit), store, api
- Route `/app/firmware` + nav item in sidebar
- Follow `features/rules/` pattern (Zustand store, axios api, pages in feature folder)
- MVP: `download_url` as text field (no file upload)
- Frontend + service tests (~25)

#### PR #3 — Web Serial Provisioning UI
- New standalone page at `/app/provision`
- Reuse `ProvisioningModal` logic — extract serial logic into shared composable/hook
- Flow: select unclaimed device → enter WiFi creds → open serial → send credentials → confirm
- Nav item with USB icon
- Tests (~20)

#### PR #4 — Charging/Power Management Rules
- New action types: `charging_start`, `charging_stop`, `low_power_mode`
- Extend `VALID_ACTION_TYPES` in schemas, Joi `validateConditionalConfig()`
- New trigger condition `battery_level` (threshold-based)
- Extend `RuleForm.tsx` with power management UI
- Tests (~35)

### Out of Scope
- OTA firmware updates from dashboard (separate feature)
- File upload for firmware binaries (MVP uses URL only)
- CSV/bulk device import
- White-label installer portal
- Mobile app provisioning

## Capabilities

### New Capabilities
- `installer-self-registration`: installer creates tenant + account in one step
- `firmware-management`: CRUD firmware versions from dashboard UI
- `serial-provisioning`: standalone page to provision devices via Web Serial
- `power-management-rules`: automation rules for charging and battery control

### Modified Capabilities
- `device-management`: claim_token auto-generation and regeneration endpoint
- `device-provisioning`: standalone provisioning page (was modal-only in DeviceDetailPage)
- `automation-rules`: new action types and battery trigger conditions

## Approach

### PR #1 — Installer Backend
- New `auth.service.installerRegister()` — wraps tenant + user creation + login in a transaction using Knex transaction
- Joi schema: `{ name, email, password, companyName? }` — no tenantId input
- Reuse existing `signAccessToken` / `signRefreshToken` for immediate login after registration
- Migration 015: `knex.schema.table('tenants', t => { t.string('contact_email'); t.jsonb('metadata'); })`
- Device `create()` already generates `device_token` — add parallel `claim_token: uuidv4()`
- New `regenerateClaimToken()` service method + route

### PR #2 — Firmware Frontend
- Mirror `features/rules/` structure exactly: `{Page, Form, store, api}` + `components/` + `__tests__/`
- `FirmwareListPage.tsx`: table with version, hardware_model, download_url link, actions
- `FirmwareForm.tsx`: dialog/modal form for create + edit
- `firmwareStore.ts`: Zustand with list CRUD + selected item
- `firmwareApi.ts`: typed axios calls matching backend

### PR #3 — Provisioning UI
- Extract `sendViaSerial()` + browser check into `hooks/useSerialProvisioning.ts`
- New `ProvisionPage.tsx`: device picker dropdown → WiFi form → serial flow → result
- Reuse existing `GET /api/devices/:id/provisioning-credentials` endpoint

### PR #4 — Power Rules
- Add `charging_start`, `charging_stop`, `low_power_mode` to `VALID_ACTION_TYPES`
- Add validation in `validateConditionalConfig`: `charging_start/stop` requires `{ deviceId, relay, state: "on"|"off" }`, `low_power_mode` requires `{ deviceId, threshold: number }`
- Extend `executeAction()` with new cases — publish MQTT command for charging relay
- Add `battery_level` as a new trigger condition in threshold rules (just another datastreamKey)
- Update `RuleForm.tsx` action type selector with new options + conditional config inputs

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/modules/auth/` | Modified | New `installerRegister()` in service + routes + schemas |
| `backend/src/modules/devices/` | Modified | claim_token on create, regenerateClaimToken() in service + routes |
| `backend/src/shared/db/migrations/` | New | 015_add_installer_fields_to_tenants.js |
| `backend/src/modules/installers/` | Modified | Now works correctly after migration 015 |
| `frontend/src/features/firmware/` | New | Full CRUD feature module (5+ files) |
| `frontend/src/features/provision/` | New | Standalone provisioning page + serial hook |
| `frontend/src/hooks/` | New | `useSerialProvisioning.ts` |
| `frontend/src/components/AppShell.tsx` | Modified | New nav items for firmware + provision |
| `backend/src/modules/rules/rulesEngine.js` | Modified | New action types in executeAction() |
| `backend/src/modules/rules/rules.schemas.js` | Modified | Extended VALID_ACTION_TYPES + validation |
| `frontend/src/features/rules/RuleForm.tsx` | Modified | Power management options |
| `frontend/src/features/rules/rulesStore.ts` | Modified | Type updates for new action types |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Installer registers but can't login (cookie issue) | Low | Reuse proven login flow from existing auth service |
| `contact_email`/`metadata` crash in production if migration missed | Medium | Migration 015 is the FIRST task in PR #1 — non-negotiable prerequisite |
| Web Serial only works in Chrome/Edge | Low | Already guarded in ProvisioningModal — show fallback UI |
| Power rules interfere with existing relay rules | Low | New action types are distinct from existing `relay`/`command` — no overlap |
| Breaking existing device create (adding claim_token) | Low | `claim_token` is nullable on creation, auto-generated only for new devices |

## Rollback Plan

Per PR:
- **PR #1**: Drop migration 015, remove new route from auth.routes.js, revert device create logic
- **PR #2**: Remove `features/firmware/` directory, revert AppShell nav items
- **PR #3**: Remove `features/provision/` and `hooks/useSerialProvisioning.ts`, revert AppShell
- **PR #4**: Revert `VALID_ACTION_TYPES` in schemas, revert `executeAction()` switch, revert RuleForm

Each PR is independently revertible — no cross-PR dependencies that block rollback.

## Dependencies

- PR #1 → PR #2: PR #1 includes the tenant migration fix that the rest relies on
- PR #1 → PR #3: PR #1 adds claim_token auto-generation — provisioning page lists unclaimed devices
- PR #1 → PR #4: PR #4 uses existing rules engine (already deployed in Phase 6)
- PR #2 → PR #3: None (independent)
- PR #4: Standalone — only depends on existing Phase 6 rules engine

## Success Criteria

- [ ] Installer registers with name + email + password → gets tenant created + logged in immediately
- [ ] New devices auto-generate unique claim_token (visible in device detail)
- [ ] Claim token can be regenerated per device
- [ ] Installer update no longer crashes (tenant columns bug fixed)
- [ ] Firmware list page shows all versions for tenant's hardware models
- [ ] Firmware create form accepts version, hardware_model, download_url, release_notes
- [ ] Standalone provisioning page lets installer pick unclaimed device → serial provision
- [ ] Power management rules trigger MQTT commands on battery thresholds
- [ ] All tests pass: ~35 backend (PR1) + ~25 frontend/backend (PR2) + ~20 (PR3) + ~35 (PR4)
- [ ] Each PR < 400 lines changed
