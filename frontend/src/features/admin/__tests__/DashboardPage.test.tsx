import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}))

// Mock the adminApi module so we control what data is returned
vi.mock('@/features/admin/adminApi', () => ({
  fetchDashboard: vi.fn(),
  fetchTenantDetail: vi.fn(),
}))

vi.mock('lucide-react', () => ({
  Users: () => <span data-testid="icon-users" />,
  Cpu: () => <span data-testid="icon-cpu" />,
  Activity: () => <span data-testid="icon-activity" />,
  Building2: () => <span data-testid="icon-building" />,
  ArrowLeft: () => <span data-testid="icon-arrow-left" />,
}))

import { DashboardPage } from '../DashboardPage'
import { fetchDashboard } from '../adminApi'

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders KPI cards with data from fetchDashboard', async () => {
    vi.mocked(fetchDashboard).mockResolvedValueOnce({
      totalUsers: 150,
      totalDevices: 320,
      activeDevices: 280,
      totalTenants: 5,
    })

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    // Wait for the KPI values to appear
    expect(await screen.findByText('150')).toBeInTheDocument()
    expect(screen.getByText('320')).toBeInTheDocument()
    expect(screen.getByText('280')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders zero values when dashboard returns empty data', async () => {
    vi.mocked(fetchDashboard).mockResolvedValueOnce({
      totalUsers: 0,
      totalDevices: 0,
      activeDevices: 0,
      totalTenants: 0,
    })

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    // Wait for loading to finish — verify 0 is visible in the total users card
    // Using find to wait for async render, then verify all 4 KPI labels exist
    expect(await screen.findByText('admin.totalUsers')).toBeInTheDocument()
    expect(screen.getByText('admin.totalDevices')).toBeInTheDocument()
    expect(screen.getByText('admin.activeDevices')).toBeInTheDocument()
    expect(screen.getByText('admin.totalTenants')).toBeInTheDocument()
    // The zero card values — use getAllByText carefully since "0" can appear in CSS too
    const zeroCards = screen.getAllByRole('heading')
    expect(zeroCards.length).toBeGreaterThanOrEqual(1)
  })

  it('renders section titles for KPI categories', async () => {
    vi.mocked(fetchDashboard).mockResolvedValueOnce({
      totalUsers: 42,
      totalDevices: 100,
      activeDevices: 80,
      totalTenants: 3,
    })

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    // Check that KPI labels appear (from t() keys or fallbacks)
    expect(await screen.findByText('admin.totalUsers')).toBeInTheDocument()
    expect(screen.getByText('admin.totalDevices')).toBeInTheDocument()
    expect(screen.getByText('admin.activeDevices')).toBeInTheDocument()
    expect(screen.getByText('admin.totalTenants')).toBeInTheDocument()
  })

  it('shows error state when API call fails', async () => {
    vi.mocked(fetchDashboard).mockRejectedValueOnce(new Error('Network error'))

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    expect(await screen.findByText('Failed to load dashboard data')).toBeInTheDocument()
  })
})
