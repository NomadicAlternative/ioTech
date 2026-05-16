# super-admin-auth Specification

## Purpose

Role-based super_admin authentication: DB-backed role enum, JWT payload, middleware guard replacing email-based check.

## Requirements

| ID | Requirement | Strength |
|----|------------|----------|
| AUTH-001 | DB migration SHALL add `user_role` enum (`installer`, `admin`, `super_admin`) and set `admin@iotech.dev` to `super_admin` | MUST |
| AUTH-002 | JWT login/refresh payload MUST include `role` claim | MUST |
| AUTH-003 | `superAdmin` middleware SHALL enforce `req.user.role === 'super_admin'`, replacing email env-var check | MUST |
| AUTH-004 | Frontend auth store SHALL derive `isSuperAdmin` from JWT `role`, not from email list | MUST |
| AUTH-005 | Installer users SHALL NOT access `/api/admin/*` endpoints (403) | MUST |

### Scenario: Super admin login and access
- GIVEN user `admin@iotech.dev` with role `super_admin`
- WHEN login returns JWT with `role: super_admin`
- THEN middleware permits access to `/api/admin/*`
- AND frontend redirects to `/app/admin/`

### Scenario: Installer blocked from admin
- GIVEN user with role `installer`
- WHEN request hits `/api/admin/*`
- THEN middleware returns 403
- AND frontend hides admin nav items

### Scenario: Transition safety
- GIVEN migration is pending deployment
- WHEN both old email-check and new role-check coexist
- THEN either check passing grants access (no break during deploy)
