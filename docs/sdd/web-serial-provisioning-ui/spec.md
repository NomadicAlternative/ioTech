# PR #3 — Web Serial Provisioning UI — Delta Specs

## Delta: serial-provisioning (NEW Domain)

### SERIAL-PROV-1: Standalone Provisioning Page

The system MUST expose a `/app/provision` route protected by auth that renders a standalone provisioning page.

The page MUST display a list of unclaimed devices (status === "unclaimed") for the current tenant, fetched via `GET /api/devices?status=unclaimed`.

#### UI/UX Specs
- **Device list table**: Columns for Name, Hardware ID, Claim Token (masked with copy button), Status badge
- **Claim Token cell**: Show `••••-••••-••••` with a Copy icon button that reveals tooltip "Copied!" on click
- **"Provision via USB" button**: Per-row button, enabled only for unclaimed devices. Icon: `Usb` (lucide-react)
- **Empty state**: "No unclaimed devices" with illustration when list is empty
- **Loading state**: Skeleton rows (matching existing DeviceListPage pattern)
- **Error state**: Inline error banner with retry button

#### Acceptance Criteria
- [ ] Route `/app/provision` exists under the `/app/*` layout
- [ ] Only unclaimed devices (status === "unclaimed") appear in the list
- [ ] Claim token is masked by default, copyable via button
- [ ] "Provision via USB" button opens ProvisioningModal on click
- [ ] Empty state renders when no unclaimed devices exist
- [ ] Page is responsive at xs breakpoint

### SERIAL-PROV-2: Web Serial Flow from Standalone Context

Clicking "Provision via USB" on any row MUST open the ProvisioningModal with the selected device's ID and name.

The Web Serial flow MUST be identical to the existing flow in DeviceDetailPage:
1. Browser compatibility check -> fallback message for non-Chrome/Edge
2. WiFi credentials form (SSID + password, password masked)
3. Fetch credentials via `GET /api/devices/:id/provisioning-credentials`
4. Open serial port via `navigator.serial.requestPort()`
5. Send JSON payload repeatedly for 8s
6. Show success or error state

After successful provisioning, the device SHOULD disappear from the unclaimed list (its status changes server-side).

#### Scenarios
- GIVEN unclaimed device list, WHEN user clicks "Provision via USB", THEN ProvisioningModal opens with that device's ID and name
- GIVEN ProvisioningModal open, WHEN user completes WiFi form and clicks "Send to device", THEN Web Serial flow starts
- GIVEN Web Serial flow completes successfully, WHEN modal closes, THEN device list refreshes and provisioned device is no longer shown
- GIVEN browser does not support Web Serial, WHEN page loads, THEN fallback message renders inside the modal

### SERIAL-PROV-3: Navigation

The sidebar MUST include a "Provision" nav item with a `Usb` icon.

#### Acceptance Criteria
- [ ] Nav item "Provision" appears in the sidebar
- [ ] Icon is `Usb` from lucide-react
- [ ] Link points to `/app/provision`
- [ ] Active state matches other nav items styling
- [ ] i18n key `nav.provision` added to both `en.json` and `es.json`

---

## Delta: device-provisioning (MODIFIED Domain)

### DEV-PROV-1: ProvisioningModal Extracted

The ProvisioningModal component MUST be moved from `features/devices/components/ProvisioningModal.tsx` to `features/provisioning/components/ProvisioningModal.tsx`.

The import in `DeviceDetailPage.tsx` MUST be updated.

Component signature MUST remain unchanged: `{ deviceId: string, deviceName: string, open: boolean, onClose: () => void }`.

(Previously: ProvisioningModal was colocated inside features/devices/)

#### Acceptance Criteria
- [ ] ProvisioningModal.tsx exists at `features/provisioning/components/ProvisioningModal.tsx`
- [ ] DeviceDetailPage.tsx imports from new path
- [ ] Component API (props) is unchanged
- [ ] All existing behavior in DeviceDetailPage still works

---

## File List

### New Files
- `frontend/src/features/provisioning/ProvisionPage.tsx`
- `frontend/src/features/provisioning/provisioningStore.ts`
- `frontend/src/features/provisioning/provisioningApi.ts`
- `frontend/src/features/provisioning/__tests__/ProvisionPage.test.tsx`

### Moved Files
- `frontend/src/features/devices/components/ProvisioningModal.tsx` -> `frontend/src/features/provisioning/components/ProvisioningModal.tsx`

### Modified Files
- `frontend/src/features/devices/DeviceDetailPage.tsx` — update import path
- `frontend/src/components/AppShell.tsx` — add Provision nav item
- `frontend/src/App.tsx` — add `/app/provision` route
- `frontend/src/i18n/locales/en.json` — add nav + page keys
- `frontend/src/i18n/locales/es.json` — add nav + page keys

## Test Scenarios

### T1: Unclaimed device list renders correctly
GIVEN mock returns 3 unclaimed devices and 1 claimed device
WHEN ProvisionPage renders
THEN only 3 unclaimed devices appear

### T2: Empty state
GIVEN mock returns empty list
WHEN ProvisionPage renders
THEN "No unclaimed devices" empty state is shown

### T3: Loading skeleton
GIVEN fetch is pending
WHEN ProvisionPage renders
THEN skeleton rows are displayed

### T4: Copy claim token
GIVEN unclaimed device list is rendered
WHEN user clicks copy button
THEN navigator.clipboard.writeText is called with the token

### T5: Provision button opens modal
GIVEN unclaimed device list is rendered
WHEN user clicks "Provision via USB"
THEN ProvisioningModal opens with that device's id and name

### T6: Unsupported browser fallback
GIVEN navigator.serial is undefined
WHEN ProvisioningModal opens
THEN browser check fails and fallback message is displayed

### T7: Web Serial API mock setup
GIVEN test environment with jsdom
WHEN serial API tests run
THEN navigator.serial is mocked with requestPort(), open(), getWriter(), close()
