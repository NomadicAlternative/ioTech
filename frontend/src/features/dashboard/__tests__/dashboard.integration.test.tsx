import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('@/features/dashboard/api', () => ({
  fetchDashboards: vi.fn(),
  fetchDashboard: vi.fn(),
  createDashboard: vi.fn(),
  updateDashboard: vi.fn(),
  deleteDashboard: vi.fn(),
  saveLayout: vi.fn(),
  fetchClients: vi.fn(),
  fetchDashboardSharedClients: vi.fn(),
  shareDashboard: vi.fn(),
  revokeDashboardShare: vi.fn(),
}))

// Mock react-grid-layout to avoid jsdom layout complexity
vi.mock('react-grid-layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="grid-layout">{children}</div>
  ),
}))

// Avoid Leaflet CSS & map issues
vi.mock('@/features/widgets/types/MapWidget', () => ({
  MapWidget: () => <div data-testid="map-widget" />,
  MapConfigFields: () => <div />,
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, onClick, className }: {
    children: React.ReactNode
    onClick?: () => void
    className?: string
  }) => <div onClick={onClick} className={className}>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
  }) => <button onClick={onClick} disabled={disabled}>{children}</button>,
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}))

vi.mock('@/features/widgets/WidgetConfigPanel', () => ({
  WidgetConfigPanel: () => null,
}))

vi.mock('@/features/widgets/WidgetRenderer', () => ({
  WidgetRenderer: ({ entry }: { entry: { config: { name: string } } }) => (
    <div data-testid={`widget-${entry.config.name}`}>{entry.config.name}</div>
  ),
}))

vi.mock('@/features/widgets/registry', () => ({
  WIDGET_TYPES: [
    { type: 'gauge', label: 'Gauge', defaultSize: { w: 3, h: 3 }, defaultConfig: {} },
  ],
}))

import * as dashboardApi from '@/features/dashboard/api'
import { useDashboardStore } from '@/features/dashboard/dashboardStore'
import { useAuthStore } from '@/features/auth/authStore'
import { DashboardListPage } from '@/features/dashboard/DashboardListPage'
import { DashboardEditorPage } from '@/features/dashboard/DashboardEditorPage'

const MOCK_DASHBOARD = {
  id: 'dash-1',
  name: 'Home Automation',
  description: 'Main dashboard',
  layout: [],
  ownerId: 'user-1',
  isShared: false,
  widgetCount: 2,
  updatedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
}

const MOCK_DASHBOARD_WITH_WIDGET = {
  ...MOCK_DASHBOARD,
  layout: [
    {
      i: 'widget-1',
      x: 0, y: 0, w: 3, h: 3,
      widgetType: 'gauge',
      config: { name: 'Temperature', deviceId: null, datastreamKey: null, settings: {} },
    },
  ],
}

function resetStores() {
  useDashboardStore.setState({
    dashboards: [],
    currentDashboard: null,
    layout: [],
    isEditing: false,
    isSaving: false,
    saveError: null,
  })
  useAuthStore.setState({
    user: { id: 'user-1', email: 'installer@test.com', role: 'installer', tenantId: 'tenant-1' },
    accessToken: 'mock-token',
    isAuthenticated: true,
  })
}

// ─── DashboardListPage ────────────────────────────────────────────────────────
describe('DashboardListPage', () => {
  beforeEach(() => {
    resetStores()
    vi.clearAllMocks()
  })

  it('renders dashboards fetched from API', async () => {
    vi.mocked(dashboardApi.fetchDashboards).mockResolvedValueOnce([MOCK_DASHBOARD])

    render(
      <MemoryRouter>
        <DashboardListPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Home Automation')).toBeInTheDocument()
    })
  })

  it('shows empty state when no dashboards', async () => {
    vi.mocked(dashboardApi.fetchDashboards).mockResolvedValueOnce([])

    render(
      <MemoryRouter>
        <DashboardListPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('No dashboards yet')).toBeInTheDocument()
    })
  })

  it('opens create dialog when New Dashboard button is clicked', async () => {
    vi.mocked(dashboardApi.fetchDashboards).mockResolvedValueOnce([])

    render(
      <MemoryRouter>
        <DashboardListPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('No dashboards yet')).toBeInTheDocument()
    })

    await userEvent.click(screen.getAllByText('New Dashboard')[0])

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('creates dashboard and navigates to editor', async () => {
    vi.mocked(dashboardApi.fetchDashboards).mockResolvedValueOnce([])
    vi.mocked(dashboardApi.createDashboard).mockResolvedValueOnce({ ...MOCK_DASHBOARD, id: 'dash-new' })

    const { container } = render(
      <MemoryRouter initialEntries={['/app/dashboards']}>
        <Routes>
          <Route path="/app/dashboards" element={<DashboardListPage />} />
          <Route path="/app/dashboards/:id/edit" element={<div data-testid="editor-page" />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => screen.getByText('No dashboards yet'))

    // Open dialog
    await userEvent.click(screen.getAllByText('New Dashboard')[0])
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Fill name
    const input = screen.getByPlaceholderText('e.g. Home Automation')
    await userEvent.type(input, 'New Dashboard')

    // Submit
    await userEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(dashboardApi.createDashboard).toHaveBeenCalledWith('New Dashboard', '')
    })

    // Should navigate to editor
    await waitFor(() => {
      expect(container.querySelector('[data-testid="editor-page"]')).toBeInTheDocument()
    })
  })
})

// ─── DashboardEditorPage ──────────────────────────────────────────────────────
describe('DashboardEditorPage', () => {
  beforeEach(() => {
    resetStores()
    vi.clearAllMocks()
    vi.mocked(dashboardApi.saveLayout).mockResolvedValue(undefined)
    vi.mocked(dashboardApi.fetchClients).mockResolvedValue([])
    vi.mocked(dashboardApi.fetchDashboardSharedClients).mockResolvedValue([])
  })

  it('loads dashboard and renders grid when layout has widgets', async () => {
    vi.mocked(dashboardApi.fetchDashboard).mockResolvedValueOnce(MOCK_DASHBOARD_WITH_WIDGET)

    render(
      <MemoryRouter initialEntries={['/app/dashboards/dash-1/edit']}>
        <Routes>
          <Route path="/app/dashboards/:id/edit" element={<DashboardEditorPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('grid-layout')).toBeInTheDocument()
    })

    expect(screen.getByTestId('widget-Temperature')).toBeInTheDocument()
  })

  it('shows widget palette with all widget types', async () => {
    vi.mocked(dashboardApi.fetchDashboard).mockResolvedValueOnce(MOCK_DASHBOARD)

    render(
      <MemoryRouter initialEntries={['/app/dashboards/dash-1/edit']}>
        <Routes>
          <Route path="/app/dashboards/:id/edit" element={<DashboardEditorPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Gauge')).toBeInTheDocument()
    })
  })

  it('adds a widget to the grid when clicked from palette', async () => {
    vi.mocked(dashboardApi.fetchDashboard).mockResolvedValueOnce(MOCK_DASHBOARD)

    render(
      <MemoryRouter initialEntries={['/app/dashboards/dash-1/edit']}>
        <Routes>
          <Route path="/app/dashboards/:id/edit" element={<DashboardEditorPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => screen.getByText('Gauge'))

    await act(async () => {
      await userEvent.click(screen.getByText('Gauge'))
    })

    expect(useDashboardStore.getState().layout).toHaveLength(1)
    expect(useDashboardStore.getState().layout[0].widgetType).toBe('gauge')
  })

  it('removes widget from layout when setLayout is called with filtered array', () => {
    const entry = {
      i: 'w-1',
      x: 0, y: 0, w: 3, h: 3,
      widgetType: 'gauge',
      config: { name: 'G', deviceId: null, datastreamKey: null, settings: {} },
    }

    useDashboardStore.setState({ layout: [entry] })

    act(() => {
      useDashboardStore.getState().setLayout([])
    })

    expect(useDashboardStore.getState().layout).toHaveLength(0)
  })
})
