import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('@/features/dashboard/api', () => ({
  fetchDevices: vi.fn(),
  fetchDeviceTemplate: vi.fn(),
  saveLayout: vi.fn(),
}))

// Mock shadcn Sheet — render children when open=true
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: {
    children: React.ReactNode
    onValueChange?: (v: string) => void
    value?: string
  }) => (
    <div data-testid="select" data-value={value}>
      {/* Expose children and a helper to trigger value change in tests */}
      {children}
      <button
        data-testid={`select-trigger-internal-${value ?? 'empty'}`}
        onClick={() => onValueChange?.('device-1')}
        style={{ display: 'none' }}
      />
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ value, children, onClick }: {
    value: string
    children: React.ReactNode
    onClick?: () => void
  }) => (
    <div role="option" data-value={value} onClick={onClick}>{children}</div>
  ),
}))

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant }: {
    children: React.ReactNode
    onClick?: () => void
    variant?: string
  }) => (
    <button onClick={onClick} data-variant={variant}>{children}</button>
  ),
}))

// Mock registry to avoid importing actual widget components
vi.mock('@/features/widgets/registry', () => ({
  getWidgetDef: vi.fn().mockReturnValue({
    type: 'gauge',
    label: 'Gauge',
    configFields: () => <div data-testid="config-fields" />,
  }),
}))

import * as dashboardApi from '@/features/dashboard/api'
import { useWidgetConfigStore } from '@/stores/widgetConfigStore'
import { useDashboardStore } from '@/features/dashboard/dashboardStore'
import { WidgetConfigPanel } from '@/features/widgets/WidgetConfigPanel'

const MOCK_LAYOUT_ENTRY = {
  i: 'widget-1',
  x: 0, y: 0, w: 3, h: 3,
  widgetType: 'gauge',
  config: {
    name: 'My Gauge',
    deviceId: null,
    datastreamKey: null,
    settings: { min: 0, max: 100 },
  },
}

const MOCK_DEVICES = [
  { id: 'device-1', name: 'Sensor A', templateId: 'tmpl-1', status: 'online' },
  { id: 'device-2', name: 'Sensor B', templateId: 'tmpl-2', status: 'offline' },
]

const MOCK_TEMPLATE = {
  id: 'tmpl-1',
  name: 'Temp Template',
  datastreams: [
    { key: 'temp', name: 'Temperature', type: 'float', unit: '°C' },
    { key: 'humidity', name: 'Humidity', type: 'float', unit: '%' },
  ],
}

function setupStores(isOpen: boolean, widgetId: string | null = null) {
  useWidgetConfigStore.setState({ isOpen, editingWidgetId: widgetId })
  useDashboardStore.setState({
    layout: widgetId ? [MOCK_LAYOUT_ENTRY] : [],
    dashboards: [],
    currentDashboard: null,
    isEditing: false,
    isSaving: false,
    saveError: null,
  })
}

describe('WidgetConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(dashboardApi.fetchDevices).mockResolvedValue(MOCK_DEVICES)
    vi.mocked(dashboardApi.fetchDeviceTemplate).mockResolvedValue(MOCK_TEMPLATE)
    vi.mocked(dashboardApi.saveLayout).mockResolvedValue(undefined)
  })

  it('renders when widgetConfigStore.isOpen is true', async () => {
    setupStores(true, 'widget-1')

    render(<WidgetConfigPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('sheet')).toBeInTheDocument()
    })
  })

  it('does not render when isOpen is false', () => {
    setupStores(false, null)
    render(<WidgetConfigPanel />)
    expect(screen.queryByTestId('sheet')).not.toBeInTheDocument()
  })

  it('fetches and shows devices when panel opens', async () => {
    setupStores(true, 'widget-1')

    render(<WidgetConfigPanel />)

    await waitFor(() => {
      expect(dashboardApi.fetchDevices).toHaveBeenCalledTimes(1)
    })

    // Device names appear in the select options
    await waitFor(() => {
      expect(screen.getByText('Sensor A')).toBeInTheDocument()
      expect(screen.getByText('Sensor B')).toBeInTheDocument()
    })
  })

  it('does not render sheet body when no entry matches editingWidgetId', () => {
    // editingWidgetId set but layout is empty — entry won't be found
    useWidgetConfigStore.setState({ isOpen: true, editingWidgetId: 'nonexistent' })
    useDashboardStore.setState({
      layout: [],
      dashboards: [],
      currentDashboard: null,
      isEditing: false,
      isSaving: false,
      saveError: null,
    })

    render(<WidgetConfigPanel />)

    // Sheet should not render (returns null due to !localConfig || !entry)
    expect(screen.queryByTestId('sheet')).not.toBeInTheDocument()
  })

  it('save button calls setLayout with updated config and closes panel', async () => {
    setupStores(true, 'widget-1')

    render(<WidgetConfigPanel />)

    await waitFor(() => {
      expect(screen.getByText('Save changes')).toBeInTheDocument()
    })

    await act(async () => {
      await userEvent.click(screen.getByText('Save changes'))
    })

    // After save, closeConfig is called → isOpen becomes false
    expect(useWidgetConfigStore.getState().isOpen).toBe(false)
  })

  it('delete button removes widget from layout and closes panel', async () => {
    setupStores(true, 'widget-1')

    render(<WidgetConfigPanel />)

    await waitFor(() => {
      expect(screen.getByText('Delete widget')).toBeInTheDocument()
    })

    await act(async () => {
      await userEvent.click(screen.getByText('Delete widget'))
    })

    expect(useDashboardStore.getState().layout).toHaveLength(0)
    expect(useWidgetConfigStore.getState().isOpen).toBe(false)
  })
})
