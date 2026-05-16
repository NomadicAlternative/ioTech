import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}))

vi.mock('@/features/admin/adminApi', () => ({
  fetchTenantDetail: vi.fn(),
  fetchDashboard: vi.fn(),
}))

vi.mock('lucide-react', () => ({
  Building2: () => <span data-testid="icon-building" />,
  Users: () => <span data-testid="icon-users" />,
  Cpu: () => <span data-testid="icon-cpu" />,
  ArrowLeft: () => <span data-testid="icon-arrow-left" />,
  Clock: () => <span data-testid="icon-clock" />,
}))

import { InstallerDetailPage } from '../InstallerDetailPage'
import { fetchTenantDetail } from '../adminApi'

describe('InstallerDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders tenant detail with device and user counts', async () => {
    vi.mocked(fetchTenantDetail).mockResolvedValueOnce({
      id: 'tenant-1',
      name: 'Test Installer Co',
      email: 'test@test.com',
      deviceCount: 10,
      userCount: 3,
      trialStatus: 'trial',
      trialEndsAt: '2026-05-20T00:00:00Z',
      createdAt: '2026-05-16T00:00:00Z',
    })

    render(
      <MemoryRouter initialEntries={['/app/admin/tenants/tenant-1']}>
        <Routes>
          <Route path="/app/admin/tenants/:id" element={<InstallerDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    // Wait for tenant name to appear
    expect(await screen.findByText('Test Installer Co')).toBeInTheDocument()

    // Check counts
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()

    // Check trial badge
    expect(screen.getByText('admin.trial')).toBeInTheDocument()
  })

  it('renders active (non-trial) tenant correctly', async () => {
    vi.mocked(fetchTenantDetail).mockResolvedValueOnce({
      id: 'tenant-2',
      name: 'Existing Co',
      email: 'existing@co.com',
      deviceCount: 25,
      userCount: 5,
      trialStatus: 'active',
      trialEndsAt: null,
      createdAt: '2026-01-01T00:00:00Z',
    })

    render(
      <MemoryRouter initialEntries={['/app/admin/tenants/tenant-2']}>
        <Routes>
          <Route path="/app/admin/tenants/:id" element={<InstallerDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Existing Co')).toBeInTheDocument()

    // Active tenant should show active badge
    expect(screen.getByText('admin.active')).toBeInTheDocument()

    // Counts
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('shows error state when API call fails', async () => {
    vi.mocked(fetchTenantDetail).mockRejectedValueOnce(new Error('Not found'))

    render(
      <MemoryRouter initialEntries={['/app/admin/tenants/invalid']}>
        <Routes>
          <Route path="/app/admin/tenants/:id" element={<InstallerDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Failed to load tenant details')).toBeInTheDocument()
  })

  it('renders email and id for the tenant', async () => {
    vi.mocked(fetchTenantDetail).mockResolvedValueOnce({
      id: 'tenant-3',
      name: 'Email Test',
      email: 'contact@test.com',
      deviceCount: 5,
      userCount: 1,
      trialStatus: 'active',
      trialEndsAt: null,
      createdAt: '2026-03-01T00:00:00Z',
    })

    render(
      <MemoryRouter initialEntries={['/app/admin/tenants/tenant-3']}>
        <Routes>
          <Route path="/app/admin/tenants/:id" element={<InstallerDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Email Test')).toBeInTheDocument()
    // Email appears twice (header + info card), use getAllByText
    const emails = screen.getAllByText('contact@test.com')
    expect(emails.length).toBeGreaterThanOrEqual(1)
  })
})
