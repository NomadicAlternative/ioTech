# Proposal: Super Admin Panel

## Intent

ioTech currently has no super admin role — all users are installers who only see their own tenant-scoped data via RLS. The existing `superAdmin.js` middleware is email-based (env var list), not role-based. We need a proper `super_admin` role backed by the DB, a dedicated admin panel, and the billing foundation (`trial_ends_at`, `status`, `plan` on tenants) to support the future trial→Stripe→full-access revenue model.

## Scope

### In Scope
- DB migration: `users.role` gets enum values `installer`, `admin`, `super_admin`; `tenants` gets `trial_ends_at`, `status` (enum), `plan` (enum)
- Promote `admin@iotech.dev` to `super_admin` via migration
- Refactor `superAdmin.js` middleware to check DB role (`super_admin`) instead of email env var
- New admin endpoints: `GET /api/admin/dashboard` (KPIs), `GET /api/admin/tenants/:id` (drill-down), plus existing tenant CRUD
- Admin queries BYPASS RLS by using `db` directly (not `withTenant()`)
- Trial expiry middleware (no-op for existing tenants — all set to `active`)
- Frontend: `/app/admin/` routes (DashboardPage, InstallersPage, InstallerDetailPage, CreateInstallerPage), conditional sidebar for super_admin only
- Login/refresh JWT includes `role`, frontend decodes and routes by role
- Super admin creates installers manually (already exists as `POST /api/admin/tenants`)

### Out of Scope
- Stripe integration (separate future change)
- Feature gating by plan (limiting devices/clients per plan)
- UI showing installer "you have X days left"
- Real-time telemetry metrics in admin dashboard
- Intermediate roles (e.g. "support")

## Capabilities

### New Capabilities
- `super-admin-auth`: Role-based super_admin authentication — DB-backed role, JWT payload, middleware guard
- `admin-panel`: Super admin dashboard with cross-tenant KPIs, installer list, drill-down, create installer
- `trial-billing`: Tenant trial columns (`trial_ends_at`, `status`, `plan`), trial grant on registration, expiry check middleware

### Modified Capabilities
- None — this is the first SDD cycle for billing/admin in ioTech

## Approach

4 phases, TDD-driven, each producing test-first implementation:

**Phase 1 — Auth & Role**: Migration adds enum type `user_role` with values `installer | admin | super_admin`, alters `users.role` column, updates default. Migration adds `trial_ends_at`, `status` (enum: `trial | active | expired`), `plan` (enum: `base | enterprise` default `base`) to `tenants`. Seeds existing tenants with `status='active'`. Promotes `admin@iotech.dev` to `super_admin`. Refactors `superAdmin.js` to check `req.user.role === 'super_admin'` (role in JWT already works). Adds migration test and middleware test.

**Phase 2 — Admin Backend**: New endpoints under `backend/src/modules/admin/`:
- `GET /api/admin/dashboard` — cross-tenant KPIs (total users, total devices, active devices, total tenants)
- `GET /api/admin/tenants/:id` — single tenant drill-down with device/user counts
- Existing `GET /api/admin/tenants` and `POST /api/admin/tenants` already exist and work
- All use `db` directly (no `withTenant()`) to bypass RLS
- Joi validation schemas per admin endpoint

**Phase 3 — Frontend Admin Panel**: 
- `/app/admin/` sub-route under existing `ProtectedRoute`
- AdminShell or conditional content in AppShell (super_admin sees admin nav items + installer nav is NOT shown — exclusive role)
- Pages: DashboardPage (KPI cards), InstallersPage (table + create), InstallerDetailPage (drill-down), CreateInstallerPage (form — reuses existing dialog)
- Role-based redirect: login decodes JWT, if `role === 'super_admin'` → redirect to `/app/admin/`

**Phase 4 — Trial Foundation**:
- `installerRegister` service sets `trial_ends_at = NOW() + 3 days`, `status = 'trial'` on new tenants
- Admin `createTenant` also grants trial (super admin can later manage)
- Middleware `checkTrialExpiry` runs after authGuard: if `user.role !== 'super_admin'` and `tenant.status === 'expired'`, block with 403
- Existing tenants seeded as `active` so no breakage

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/shared/db/migrations/017_add_super_admin_and_trial.js` | New | User role enum + tenant billing columns + seed data |
| `backend/src/shared/middleware/superAdmin.js` | Modified | From email-based to role-based check |
| `backend/src/shared/middleware/trialExpiry.js` | New | Trial expiry guard middleware |
| `backend/src/modules/admin/admin.routes.js` | Modified | Add dashboard + tenant detail endpoints |
| `backend/src/modules/admin/admin.service.js` | Modified | Add KPI queries + drill-down, trial-aware create |
| `backend/src/modules/auth/auth.service.js` | Modified | `installerRegister` grants trial |
| `backend/src/modules/auth/auth.schemas.js` | Modified | Update role enum validation |
| `frontend/src/features/auth/authStore.ts` | Modified | Derive `isSuperAdmin` from JWT `role` not email list |
| `frontend/src/components/AppShell.tsx` | Modified | Conditional admin nav, role-based visibility |
| `frontend/src/features/admin/` | Modified | Add DashboardPage, InstallerDetailPage |
| `frontend/src/App.tsx` | Modified | Add `/app/admin/*` routes |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Existing email-based superAdmin.js breaks | Medium | Refactor BEFORE migration — both checks work in parallel during transition |
| RLS blocks super admin cross-tenant queries | Low | Admin module queries use `db` directly (no `withTenant()`), bypassing RLS |
| Role enum change breaks existing installers | Low | Migration sets default `'admin'` for existing users, no data loss |
| Trial expiry blocks existing tenants accidentally | Low | Seed all existing tenants with `status='active'`, middleware only blocks `expired` |

## Rollback Plan

1. Revert migration: `knex migrate:down 017` removes column additions (non-destructive: enum can't be dropped until column is)
2. Revert `superAdmin.js` to email-based check
3. Revert frontend to original AppShell and authStore
4. Revert admin module additions

## Dependencies

- None — all changes are self-contained within the ioTech codebase

## Success Criteria

- [ ] `admin@iotech.dev` can log in with `role=super_admin` and access `/app/admin/`
- [ ] Installer users CANNOT access `/api/admin/*` (403)
- [ ] Super admin sees cross-tenant KPIs on admin dashboard
- [ ] Super admin can create installers with auto-trial
- [ ] All existing tenants remain `active` — no breakage
- [ ] All existing installer login flows unchanged
- [ ] 100% test coverage for new backend endpoints (Jest)
- [ ] Frontend tests cover role-based routing and conditional sidebar
