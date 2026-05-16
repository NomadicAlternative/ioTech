# Design: Super Admin Panel — Role-Based Auth, Admin Dashboard, Trial Foundation

## Technical Approach

Replace email-based super admin (env var list) with DB-backed `user_role` enum in 4 concurrent phases: (1) Auth & Role — migration + middleware dual-check, (2) Admin Backend — cross-tenant KPI endpoints, (3) Frontend Admin — role-gated routes + mutex nav, (4) Trial Foundation — trial columns + expiry guard. Admin queries bypass RLS via direct `db` (existing pattern). Existing tenants seeded `active` — zero breakage.

## Architecture Decisions

| Option | Tradeoffs | Decision |
|--------|-----------|----------|
| PG ENUM vs varchar for `user_role` | ENUM: data integrity, but ALTER TYPE is heavy. varchar: flexible but no DB-level constraint | **PG ENUM** — spec requires enum; migration handles cast via `USING` |
| Dual-check middleware vs full replacement | Dual: safe deploy, old check removable later. Replacement: simpler but breaks if old tokens in-flight | **Dual-check in-place** — `superAdmin.js` checks `role === 'super_admin'` OR email list; either passes (AUTH-003) |
| Mutex nav via separate shell vs conditional render | Separate AdminShell: cleaner isolation, but duplicates AppShell layout. Conditional: reuse, simpler | **Conditional render in AppShell** — filter nav items by role (ADMIN-005); single shell, less duplication |
| TrialExpiry as per-route middleware vs global wrapper | Per-route: explicit but touches N files. Global wrapper in app.js: single addition but path-based skip logic | **Per-route in app.js** — wrap each tenant-scoped route mount with `trialExpiry`; explicit, follows Express patterns |
| KPI queries: raw SQL vs Knex | Raw SQL: full control, perf. Knex: consistent with codebase patterns | **Knex with explicit joins/aggregates** — consistency over micro-optimization |

## Data Flow

```
Auth Flow
  Login → auth.service.login() → JWT {..., role: 'super_admin'} → client decodes → authStore.isSuperAdmin = (role==='super_admin')

Admin KPI Flow (bypasses RLS)
  GET /api/admin/dashboard → authGuard → superAdmin(req.user.role==='super_admin') → admin.service.getDashboard() → db('users|devices|tenants').count() ← direct db, no withTenant()

Trial Grant Flow
  installerRegister / admin.createTenant → db.transaction → tenants.insert({trial_ends_at: now+3d, status: 'trial', plan: 'base'}) → users.insert({role: 'admin'})

Trial Check Flow
  req → authGuard → trialExpiry → db('tenants').where({id: req.user.tenantId}).first() → if status==='expired' && role!=='super_admin' → 403

  tenant-scoped route → authGuard → trialExpiry → route handler
  admin route → authGuard → superAdmin → route handler  (trialExpiry NOT applied)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/src/shared/db/migrations/017_add_super_admin_and_trial.js` | Create | `user_role` ENUM, alter `users.role`, add tenant trial columns, seed `admin@iotech.dev` + existing tenants |
| `backend/src/shared/middleware/superAdmin.js` | Modify | Add `req.user.role === 'super_admin'` check alongside email list (dual) |
| `backend/src/shared/middleware/trialExpiry.js` | Create | If `role !== 'super_admin'` AND `tenant.status === 'expired'` → 403 |
| `backend/src/modules/admin/admin.service.js` | Modify | Add `getDashboard()` (cross-tenant KPIs), `getTenantDetail(id)`, trial fields in `createTenant` |
| `backend/src/modules/admin/admin.routes.js` | Modify | Add `GET /dashboard`, `GET /tenants/:id` |
| `backend/src/modules/admin/admin.schemas.js` | Create | Joi validation for dashboard queries |
| `backend/src/modules/auth/auth.service.js` | Modify | `installerRegister` sets `trial_ends_at`, `status='trial'`, `plan='base'` on tenant |
| `backend/src/modules/auth/auth.schemas.js` | Modify | Add `'super_admin'` to role enum in register schema |
| `backend/src/app.js` | Modify | Mount `trialExpiry` on tenant-scoped route groups |
| `frontend/src/features/auth/authStore.ts` | Modify | `isSuperAdmin` from `user.role === 'super_admin'`, remove email list |
| `frontend/src/components/AppShell.tsx` | Modify | Mutex nav: `ADMIN_NAV_ITEMS` vs `INSTALLER_NAV_ITEMS`, filter by role |
| `frontend/src/App.tsx` | Modify | Add `/app/admin/dashboard`, `/app/admin/tenants/:id` routes |
| `frontend/src/features/admin/DashboardPage.tsx` | Create | KPI cards (total users, devices, active devices, tenants) |
| `frontend/src/features/admin/InstallerDetailPage.tsx` | Create | Single tenant drill-down with device/user counts |
| `frontend/src/features/admin/adminApi.ts` | Modify | Add `fetchDashboard()`, `fetchTenantDetail(id)` |

## Interfaces / Contracts

```typescript
// JWT payload (unchanged structure — role already present)
interface JwtPayload {
  userId: string
  tenantId: string
  email: string
  role: 'installer' | 'admin' | 'super_admin'
}

// GET /api/admin/dashboard response
interface DashboardKPI {
  totalUsers: number
  totalDevices: number
  activeDevices: number
  totalTenants: number
}

// GET /api/admin/tenants/:id response
interface TenantDetail {
  id: string
  name: string
  email: string
  status: 'trial' | 'active' | 'expired'
  plan: 'base' | 'enterprise'
  trial_ends_at: string | null
  deviceCount: number
  userCount: number
  created_at: string
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `superAdmin` middleware — dual check (role + email) | Mock `req.user`, assert both paths grant access, assert 401 when neither passes |
| Unit | `verifyToken` — unaffected by changes | Existing authGuard tests should pass unchanged |
| Unit | `trialExpiry` middleware — expired vs active vs super_admin | Mock `req.user` + `db('tenants').first()`, assert 403 only for non-SA expired |
| Integration | `GET /api/admin/dashboard` — KPI aggregation across tenants | Supertest with auth header, verify counts across seeded tenants |
| Integration | `POST /api/auth/installer-register` — trial grant | Register, assert tenant has `trial_ends_at` 3d from now, `status='trial'` |
| Integration | Admin `createTenant` — trial grant | Super admin creates tenant, assert same trial fields |
| Integration | Existing installer routes — trial expiry blocks | Set tenant `status='expired'`, assert 403 on device/dashboard routes |
| Frontend | `authStore` — `isSuperAdmin` derived from role, not email | Mock JWT with `role: 'super_admin'` → `isSuperAdmin === true` |
| Frontend | `AppShell` — mutex nav for each role | Render with super_admin role → admin items visible, installer hidden. Reverse for installer role |
| E2E | Full admin flow: login as SA → see admin nav → view KPIs → create installer | Playwright |

## Migration / Rollout

1. **Migration first** — `knex migrate:latest` adds ENUM types, alters columns, seeds data. All existing data preserved.
2. **Deploy backend** — `superAdmin.js` dual-check active. Old email-list still works. New role-based check also works.
3. **Deploy frontend** — `authStore` derives `isSuperAdmin` from JWT `role`. Existing admin users continue working because their JWT already contains `role`.
4. **Cleanup** (future) — Remove `SUPER_ADMIN_EMAILS` env var and email-check branch from `superAdmin.js`.

## Open Questions

- [ ] Should `trialExpiry` be applied to `GET` requests only or all methods? Spec says "any protected endpoint" (TRIAL-005) — all methods.
- [ ] `refreshToken` endpoint currently reads cookie — does `trialExpiry` apply there? No — refresh is auth-only, not tenant-scoped.
- [ ] `forbiddenError` (403) vs `unauthorizedError` (401) for trial expiry — spec says 403 (correct: user IS authenticated, just blocked).
