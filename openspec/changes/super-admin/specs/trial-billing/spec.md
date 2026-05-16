# trial-billing Specification

## Purpose

Tenant trial lifecycle: DB columns for trial tracking, automatic trial grant on registration, expiry enforcement middleware.

## Requirements

| ID | Requirement | Strength |
|----|------------|----------|
| TRIAL-001 | DB migration SHALL add `trial_ends_at` (timestamp), `status` (enum: `trial|active|expired`), `plan` (enum: `base|enterprise`, default `base`) to `tenants` | MUST |
| TRIAL-002 | Existing tenants SHALL be seeded with `status='active'` to prevent breakage | MUST |
| TRIAL-003 | `installerRegister` service SHALL set `trial_ends_at = NOW() + 3 days`, `status = 'trial'` on new registrations | MUST |
| TRIAL-004 | Admin `createTenant` SHALL auto-grant trial when creating installers | MUST |
| TRIAL-005 | `checkTrialExpiry` middleware SHALL return 403 for expired tenants, skip super_admin users | MUST |

### Scenario: New installer gets trial
- GIVEN a new installer registration
- WHEN `installerRegister` creates tenant
- THEN `trial_ends_at` is set to 3 days from now
- AND `status` is `'trial'`, `plan` is `'base'`

### Scenario: Existing tenant unaffected
- GIVEN migration runs with 50 existing tenants
- WHEN migration seeds all with `status='active'`
- THEN trial expiry middleware does NOT block them
- AND all existing login flows remain unchanged

### Scenario: Expired tenant blocked
- GIVEN tenant with `status='expired'`
- WHEN installer (non-super_admin) hits any protected endpoint
- THEN `checkTrialExpiry` middleware returns 403
- AND super_admin accessing same endpoint is NOT blocked
