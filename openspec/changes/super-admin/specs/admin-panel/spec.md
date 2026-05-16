# admin-panel Specification

## Purpose

Super admin dashboard: cross-tenant KPIs, installer management with drill-down, role-exclusive frontend routes.

## Requirements

| ID | Requirement | Strength |
|----|------------|----------|
| ADMIN-001 | `GET /api/admin/dashboard` SHALL return cross-tenant KPIs: total users, total devices, active devices, total tenants | MUST |
| ADMIN-002 | `GET /api/admin/tenants/:id` SHALL return single tenant with device and user counts (drill-down) | MUST |
| ADMIN-003 | Admin queries SHALL use `db` directly without `withTenant()` to bypass RLS | MUST |
| ADMIN-004 | Frontend SHALL expose `/app/admin/` routes under ProtectedRoute: Dashboard, Installers, InstallerDetail, CreateInstaller | MUST |
| ADMIN-005 | Navigation SHALL be mutually exclusive: super_admin sees admin nav only, installer sees installer nav only | MUST |
| ADMIN-006 | Super admin SHALL create installers via `POST /api/admin/tenants` with auto-trial grant | MUST |

### Scenario: Dashboard KPI load
- GIVEN 3 tenants with 10 devices each
- WHEN super admin requests `GET /api/admin/dashboard`
- THEN response includes `totalTenants: 3, totalDevices: 30`
- AND query aggregates across ALL tenants (no RLS filter)

### Scenario: Tenant drill-down
- GIVEN tenant ID `t-123` with 5 devices and 2 users
- WHEN super admin requests `GET /api/admin/tenants/t-123`
- THEN response includes device count, user count, and trial status
- AND installer users get 403 on same endpoint

### Scenario: Role-based navigation
- GIVEN user with role `super_admin`
- WHEN AppShell renders sidebar
- THEN sidebar shows Admin nav items (Dashboard, Installers)
- AND installer nav items are hidden (mutually exclusive roles)
