# Tasks: Super Admin Panel

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~750–900 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Backend Auth) → PR 2 (Admin Backend) → PR 3 (Frontend) |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend Auth & Migration | PR 1 | migration + middleware + auth wiring + middleware tests |
| 2 | Admin Backend Endpoints | PR 2 | admin schemas/routes/service + integration tests |
| 3 | Frontend Admin Panel | PR 3 | role-based nav, pages, API client + frontend/E2E tests |

## Phase 1: Foundation (DB + Middleware)

- [x] 1.1 Create migration `017_add_super_admin_and_trial.js` — user_role ENUM, alter users.role, tenant trial columns, seed admin@iotech.dev + existing tenants as active
- [x] 1.2 Modify `superAdmin.js` — add `role === super_admin` dual-check alongside email list
- [x] 1.3 Create `trialExpiry.js` — 403 if tenant expired && role !== super_admin, skip for SA
- [x] 1.4 Modify `auth.service.js` — installerRegister sets trial_ends_at, status='trial', plan='base'
- [x] 1.5 Modify `auth.schemas.js` — add super_admin to role enum in register schema
- [x] 1.6 Modify `app.js` — mount trialExpiry on tenant-scoped route groups

## Phase 2: Admin Backend (Endpoints)

- [x] 2.1 Create `admin.schemas.js` — Joi validation for dashboard/drill-down endpoints
- [x] 2.2 Modify `admin.service.js` — add getDashboard() (cross-tenant KPIs), getTenantDetail(id), trial fields in createTenant
- [x] 2.3 Modify `admin.routes.js` — add GET /dashboard, GET /tenants/:id with schemas + service

## Phase 3: Frontend Admin (UI)

- [x] 3.1 Modify `authStore.ts` — derive isSuperAdmin from role, remove email list check (both login + refreshToken)
- [x] 3.2 Modify `AppShell.tsx` — mutex nav: ADMIN_NAV_ITEMS vs INSTALLER_NAV_ITEMS by role
- [x] 3.3 Modify `App.tsx` — add /app/admin/dashboard, /app/admin/tenants/:id routes under ProtectedRoute
- [x] 3.4 Create `DashboardPage.tsx` — KPI cards (total users, devices, active, tenants) with data fetching
- [x] 3.5 Create `InstallerDetailPage.tsx` — tenant drill-down with device/user counts + trial status
- [x] 3.6 Modify `adminApi.ts` — add fetchDashboard(), fetchTenantDetail(id)

## Phase 4: Testing

- [x] 4.1 Unit: superAdmin middleware — dual-check grants access, no role returns 401
- [x] 4.2 Unit: trialExpiry middleware — expired blocks non-SA, active passes, SA skips
- [x] 4.3 Integration: GET /api/admin/dashboard — KPI counts across seeded tenants
- [x] 4.4 Integration: POST /api/auth/installer-register — asserts trial_ends_at + status='trial'
- [x] 4.5 Integration: admin createTenant — trial auto-grant asserted
- [x] 4.6 Integration: expired tenant blocked on protected routes (403), SA bypass
- [x] 4.7 Frontend: authStore isSuperAdmin derived from role, not email (5 tests)
- [x] 4.8 Frontend: AppShell — mutex nav items per role (5 tests)
- [ ] 4.9 E2E: full admin flow — login as SA → view KPIs → create installer (manual verification)
