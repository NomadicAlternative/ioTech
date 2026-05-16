import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

// ─── Mock axios & api before importing stores ─────────────────────────────────
vi.mock('@/lib/axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}))

vi.mock('@/features/dashboard/api', () => ({
  fetchDashboards: vi.fn(),
  fetchDashboard: vi.fn(),
  createDashboard: vi.fn(),
  updateDashboard: vi.fn(),
  deleteDashboard: vi.fn(),
  saveLayout: vi.fn(),
}))

import api from '@/lib/axios'
import * as dashboardApi from '@/features/dashboard/api'

// ─── Import stores after mocks ────────────────────────────────────────────────
import { useAuthStore } from '@/features/auth/authStore'
import { useDashboardStore } from '@/features/dashboard/dashboardStore'
import { useTelemetryStore, useTelemetryValue } from '@/stores/telemetryStore'
import { useWidgetConfigStore } from '@/stores/widgetConfigStore'

// Helper: build a fake JWT with the given payload
function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.fakesig`
}

// ─── authStore ────────────────────────────────────────────────────────────────
describe('authStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
    vi.clearAllMocks()
  })

  it('login sets user and token from JWT payload', async () => {
    const payload = {
      sub: 'user-1',
      email: 'alice@example.com',
      role: 'installer',
      tenantId: 'tenant-1',
    }
    const fakeToken = makeFakeJwt(payload)

    vi.mocked(api.post).mockResolvedValueOnce({ data: { accessToken: fakeToken } })

    await act(async () => {
      await useAuthStore.getState().login('alice@example.com', 'secret')
    })

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.accessToken).toBe(fakeToken)
    expect(state.user).toMatchObject({
      id: 'user-1',
      email: 'alice@example.com',
      role: 'installer',
      tenantId: 'tenant-1',
    })
  })

  it('logout clears user, token and isAuthenticated', async () => {
    // Seed some auth state first
    useAuthStore.setState({
      user: { id: 'u1', email: 'a@b.com', role: 'installer', tenantId: 't1' },
      accessToken: 'some-token',
      isAuthenticated: true,
    })

    vi.mocked(api.post).mockResolvedValueOnce({})

    await act(async () => {
      await useAuthStore.getState().logout()
    })

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.accessToken).toBeNull()
    expect(state.user).toBeNull()
  })

  it('logout still clears state even when API call fails', async () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'a@b.com', role: 'installer', tenantId: 't1' },
      accessToken: 'some-token',
      isAuthenticated: true,
    })

    vi.mocked(api.post).mockRejectedValueOnce(new Error('network error'))

    await act(async () => {
      await useAuthStore.getState().logout()
    })

    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('refreshToken updates accessToken and user', async () => {
    const payload = {
      sub: 'user-2',
      email: 'bob@example.com',
      role: 'client',
      tenantId: 'tenant-2',
    }
    const newToken = makeFakeJwt(payload)

    vi.mocked(api.post).mockResolvedValueOnce({ data: { accessToken: newToken } })

    await act(async () => {
      await useAuthStore.getState().refreshToken()
    })

    const state = useAuthStore.getState()
    expect(state.accessToken).toBe(newToken)
    expect(state.user?.email).toBe('bob@example.com')
    expect(state.isAuthenticated).toBe(true)
  })

  // ─── isSuperAdmin from role (AUTH-004) ──────────────────────────────────

  it('login sets isSuperAdmin=true when role is super_admin', async () => {
    const payload = {
      sub: 'sa-1',
      email: 'anyone@example.com',
      role: 'super_admin',
      tenantId: 'sa-tenant',
    }
    const fakeToken = makeFakeJwt(payload)

    vi.mocked(api.post).mockResolvedValueOnce({ data: { accessToken: fakeToken } })

    await act(async () => {
      await useAuthStore.getState().login('anyone@example.com', 'secret')
    })

    expect(useAuthStore.getState().isSuperAdmin).toBe(true)
  })

  it('login sets isSuperAdmin=false when role is installer (not in email list)', async () => {
    const payload = {
      sub: 'inst-1',
      email: 'admin@iotech.dev', // ← this email WAS in the old hardcoded list
      role: 'installer',          // ← but role is NOT super_admin
      tenantId: 't-1',
    }
    const fakeToken = makeFakeJwt(payload)

    vi.mocked(api.post).mockResolvedValueOnce({ data: { accessToken: fakeToken } })

    await act(async () => {
      await useAuthStore.getState().login('admin@iotech.dev', 'secret')
    })

    // AUTH-004: isSuperAdmin derives from role, NOT email
    expect(useAuthStore.getState().isSuperAdmin).toBe(false)
  })

  it('refreshToken sets isSuperAdmin=true when role is super_admin', async () => {
    const payload = {
      sub: 'sa-2',
      email: 'super@example.com',
      role: 'super_admin',
      tenantId: 'any',
    }
    const fakeToken = makeFakeJwt(payload)

    vi.mocked(api.post).mockResolvedValueOnce({ data: { accessToken: fakeToken } })

    await act(async () => {
      await useAuthStore.getState().refreshToken()
    })

    expect(useAuthStore.getState().isSuperAdmin).toBe(true)
  })

  it('isSuperAdmin is false for installer role in refreshToken too', async () => {
    const payload = {
      sub: 'inst-2',
      email: 'admin@iotech.dev', // old-email — should NOT grant admin now
      role: 'installer',
      tenantId: 't-2',
    }
    const fakeToken = makeFakeJwt(payload)

    vi.mocked(api.post).mockResolvedValueOnce({ data: { accessToken: fakeToken } })

    await act(async () => {
      await useAuthStore.getState().refreshToken()
    })

    expect(useAuthStore.getState().isSuperAdmin).toBe(false)
  })

  it('isSuperAdmin resets to false on logout', async () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'sa@test.com', role: 'super_admin', tenantId: 't1' },
      accessToken: 'token',
      isAuthenticated: true,
      isSuperAdmin: true,
    })

    vi.mocked(api.post).mockResolvedValueOnce({})

    await act(async () => {
      await useAuthStore.getState().logout()
    })

    expect(useAuthStore.getState().isSuperAdmin).toBe(false)
  })
})

// ─── dashboardStore ───────────────────────────────────────────────────────────
describe('dashboardStore', () => {
  const mockDashboard = {
    id: 'dash-1',
    name: 'Test Dashboard',
    description: null,
    layout: [],
    ownerId: 'user-1',
    isShared: false,
    widgetCount: 0,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }

  beforeEach(() => {
    useDashboardStore.setState({
      dashboards: [],
      currentDashboard: null,
      layout: [],
      isEditing: false,
      isSaving: false,
      saveError: null,
    })
    vi.clearAllMocks()
  })

  it('fetchDashboards populates the dashboards list', async () => {
    vi.mocked(dashboardApi.fetchDashboards).mockResolvedValueOnce([mockDashboard])

    await act(async () => {
      await useDashboardStore.getState().fetchDashboards()
    })

    expect(useDashboardStore.getState().dashboards).toHaveLength(1)
    expect(useDashboardStore.getState().dashboards[0].id).toBe('dash-1')
  })

  it('setLayout updates the layout in state', () => {
    const entry = {
      i: 'widget-1',
      x: 0, y: 0, w: 3, h: 3,
      widgetType: 'gauge',
      config: { name: 'Temp', deviceId: null, datastreamKey: null, settings: {} },
    }

    act(() => {
      useDashboardStore.getState().setLayout([entry])
    })

    expect(useDashboardStore.getState().layout).toHaveLength(1)
    expect(useDashboardStore.getState().layout[0].i).toBe('widget-1')
  })

  it('createDashboard adds the new dashboard to the front of the list', async () => {
    vi.mocked(dashboardApi.createDashboard).mockResolvedValueOnce(mockDashboard)

    await act(async () => {
      await useDashboardStore.getState().createDashboard('Test Dashboard', '')
    })

    const { dashboards } = useDashboardStore.getState()
    expect(dashboards).toHaveLength(1)
    expect(dashboards[0].id).toBe('dash-1')
  })

  it('createDashboard prepends when list already has items', async () => {
    const existing = { ...mockDashboard, id: 'dash-old' }
    useDashboardStore.setState({ dashboards: [existing] })

    const newDash = { ...mockDashboard, id: 'dash-new' }
    vi.mocked(dashboardApi.createDashboard).mockResolvedValueOnce(newDash)

    await act(async () => {
      await useDashboardStore.getState().createDashboard('New', '')
    })

    const { dashboards } = useDashboardStore.getState()
    expect(dashboards[0].id).toBe('dash-new')
    expect(dashboards[1].id).toBe('dash-old')
  })
})

// ─── telemetryStore ───────────────────────────────────────────────────────────
describe('telemetryStore', () => {
  beforeEach(() => {
    useTelemetryStore.getState().clearAll()
  })

  it('setTelemetry stores value at deviceId:datastreamKey key', () => {
    act(() => {
      useTelemetryStore.getState().setTelemetry('device-1', 'temp', 42.5, 1000)
    })

    const entry = useTelemetryStore.getState().getTelemetry('device-1:temp')
    expect(entry?.value).toBe(42.5)
    expect(entry?.ts).toBe(1000)
  })

  it('setTelemetry overwrites previous value for same key', () => {
    act(() => {
      useTelemetryStore.getState().setTelemetry('device-1', 'temp', 20, 1000)
      useTelemetryStore.getState().setTelemetry('device-1', 'temp', 25, 2000)
    })

    const entry = useTelemetryStore.getState().getTelemetry('device-1:temp')
    expect(entry?.value).toBe(25)
    expect(entry?.ts).toBe(2000)
  })

  it('useTelemetryValue selector returns correct data for a given device+key', () => {
    act(() => {
      useTelemetryStore.getState().setTelemetry('dev-A', 'humidity', 65, 5000)
    })

    const { result } = renderHook(() => useTelemetryValue('dev-A', 'humidity'))
    expect(result.current?.value).toBe(65)
    expect(result.current?.ts).toBe(5000)
  })

  it('useTelemetryValue returns undefined for unknown key', () => {
    const { result } = renderHook(() => useTelemetryValue('unknown-device', 'unknown-key'))
    expect(result.current).toBeUndefined()
  })

  it('clearAll empties the entire store', () => {
    act(() => {
      useTelemetryStore.getState().setTelemetry('dev-1', 'temp', 30, 1000)
      useTelemetryStore.getState().setTelemetry('dev-2', 'pressure', 101, 2000)
    })

    act(() => {
      useTelemetryStore.getState().clearAll()
    })

    expect(useTelemetryStore.getState().data).toEqual({})
  })
})

// ─── widgetConfigStore ────────────────────────────────────────────────────────
describe('widgetConfigStore', () => {
  beforeEach(() => {
    useWidgetConfigStore.getState().clear()
  })

  it('openConfig sets editingWidgetId and isOpen to true', () => {
    act(() => {
      useWidgetConfigStore.getState().openConfig('widget-abc')
    })

    const state = useWidgetConfigStore.getState()
    expect(state.isOpen).toBe(true)
    expect(state.editingWidgetId).toBe('widget-abc')
  })

  it('closeConfig sets isOpen to false but keeps editingWidgetId', () => {
    act(() => {
      useWidgetConfigStore.getState().openConfig('widget-abc')
      useWidgetConfigStore.getState().closeConfig()
    })

    const state = useWidgetConfigStore.getState()
    expect(state.isOpen).toBe(false)
    // editingWidgetId is preserved so panel can animate out
    expect(state.editingWidgetId).toBe('widget-abc')
  })

  it('clear resets both editingWidgetId and isOpen', () => {
    act(() => {
      useWidgetConfigStore.getState().openConfig('widget-xyz')
      useWidgetConfigStore.getState().clear()
    })

    const state = useWidgetConfigStore.getState()
    expect(state.isOpen).toBe(false)
    expect(state.editingWidgetId).toBeNull()
  })
})
