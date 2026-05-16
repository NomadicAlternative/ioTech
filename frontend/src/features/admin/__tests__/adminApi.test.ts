import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock axios ───────────────────────────────────────────────────────────────
vi.mock('@/lib/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}))

import api from '@/lib/axios'
import { fetchDashboard, fetchTenantDetail, type DashboardKpi, type TenantDetail } from '../adminApi'

describe('adminApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchDashboard', () => {
    it('returns KPIs from GET /api/admin/dashboard', async () => {
      const mockKpis: DashboardKpi = {
        totalUsers: 150,
        totalDevices: 320,
        activeDevices: 280,
        totalTenants: 5,
      }

      vi.mocked(api.get).mockResolvedValueOnce({ data: { data: mockKpis } })

      const result = await fetchDashboard()

      expect(api.get).toHaveBeenCalledWith('/api/admin/dashboard')
      expect(result).toEqual(mockKpis)
      expect(result.totalTenants).toBe(5)
      expect(result.activeDevices).toBe(280)
    })

    it('handles zero KPIs gracefully', async () => {
      const emptyKpis: DashboardKpi = {
        totalUsers: 0,
        totalDevices: 0,
        activeDevices: 0,
        totalTenants: 0,
      }

      vi.mocked(api.get).mockResolvedValueOnce({ data: { data: emptyKpis } })

      const result = await fetchDashboard()

      expect(result.totalTenants).toBe(0)
      expect(result.totalDevices).toBe(0)
    })
  })

  describe('fetchTenantDetail', () => {
    it('returns tenant detail from GET /api/admin/tenants/:id', async () => {
      const mockDetail: TenantDetail = {
        id: 'tenant-1',
        name: 'Test Installer',
        email: 'test@test.com',
        deviceCount: 10,
        userCount: 3,
        trialStatus: 'trial',
        trialEndsAt: '2026-05-20T00:00:00Z',
        createdAt: '2026-05-16T00:00:00Z',
      }

      vi.mocked(api.get).mockResolvedValueOnce({ data: { data: mockDetail } })

      const result = await fetchTenantDetail('tenant-1')

      expect(api.get).toHaveBeenCalledWith('/api/admin/tenants/tenant-1')
      expect(result).toEqual(mockDetail)
      expect(result.deviceCount).toBe(10)
      expect(result.userCount).toBe(3)
      expect(result.trialStatus).toBe('trial')
    })

    it('handles active (non-trial) tenant detail', async () => {
      const activeDetail: TenantDetail = {
        id: 'tenant-2',
        name: 'Existing Co',
        email: 'existing@co.com',
        deviceCount: 25,
        userCount: 5,
        trialStatus: 'active',
        trialEndsAt: null,
        createdAt: '2026-01-01T00:00:00Z',
      }

      vi.mocked(api.get).mockResolvedValueOnce({ data: { data: activeDetail } })

      const result = await fetchTenantDetail('tenant-2')

      expect(result.trialStatus).toBe('active')
      expect(result.trialEndsAt).toBeNull()
    })
  })
})
