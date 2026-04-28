/**
 * Widget render tests — covers the 7 data-display widgets:
 * Gauge, NumberDisplay, StatusIndicator, StatCard, ProgressBar, LineChart, Map
 *
 * For each widget:
 *   1. Renders with default config (no deviceId bound)
 *   2. Renders with a telemetry value from the store
 *   3. Custom label (name) shown by WidgetRenderer is tested in extension.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

// ─── UI component mocks ──────────────────────────────────────────────────────
vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))
vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}))
vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// ─── recharts mock — renders nothing (SVG measurement issues in jsdom) ────────
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="recharts-linechart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// ─── leaflet mock — avoids browser-only APIs in jsdom ────────────────────────
vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(() => ({
      setView: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    })),
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    marker: vi.fn(() => ({ addTo: vi.fn(), setLatLng: vi.fn() })),
    Icon: { Default: { prototype: {}, mergeOptions: vi.fn() } },
  },
}))
vi.mock('leaflet/dist/leaflet.css', () => ({}))

// ─── API mock ─────────────────────────────────────────────────────────────────
vi.mock('@/features/dashboard/api', () => ({
  fetchTelemetryHistory: vi.fn().mockResolvedValue([]),
}))

import { useTelemetryStore } from '@/stores/telemetryStore'
import { GaugeWidget } from '@/features/widgets/types/GaugeWidget'
import { NumberDisplayWidget } from '@/features/widgets/types/NumberDisplayWidget'
import { StatusIndicatorWidget } from '@/features/widgets/types/StatusIndicatorWidget'
import { StatCardWidget } from '@/features/widgets/types/StatCardWidget'
import { ProgressBarWidget } from '@/features/widgets/types/ProgressBarWidget'
import { LineChartWidget } from '@/features/widgets/types/LineChartWidget'
import { MapWidget } from '@/features/widgets/types/MapWidget'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Test Widget',
    deviceId: null as string | null,
    datastreamKey: null as string | null,
    settings: {} as Record<string, unknown>,
    ...overrides,
  }
}

function withDevice(settings: Record<string, unknown> = {}) {
  return makeConfig({ deviceId: 'device-1', datastreamKey: 'sensor', settings })
}

// ─── GaugeWidget ─────────────────────────────────────────────────────────────

describe('GaugeWidget', () => {
  beforeEach(() => {
    useTelemetryStore.getState().clearAll()
  })

  it('renders with default config (no deviceId) — shows 0.0', () => {
    render(
      <GaugeWidget widgetId="w1" config={makeConfig({ settings: { min: 0, max: 100 } })} isEditing={false} />
    )
    // value defaults to 0 when no telemetry
    expect(screen.getByText('0.0')).toBeInTheDocument()
  })

  it('renders min/max labels from settings', () => {
    render(
      <GaugeWidget widgetId="w1" config={makeConfig({ settings: { min: 10, max: 200 } })} isEditing={false} />
    )
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('200')).toBeInTheDocument()
  })

  it('renders telemetry value from store', () => {
    act(() => {
      useTelemetryStore.getState().setTelemetry('device-1', 'sensor', 42.5, Date.now())
    })
    render(
      <GaugeWidget widgetId="w1" config={withDevice()} isEditing={false} />
    )
    expect(screen.getByText('42.5')).toBeInTheDocument()
  })

  it('renders unit from settings', () => {
    act(() => {
      useTelemetryStore.getState().setTelemetry('device-1', 'sensor', 55, Date.now())
    })
    render(
      <GaugeWidget widgetId="w1" config={withDevice({ unit: '°C' })} isEditing={false} />
    )
    expect(screen.getByText('°C')).toBeInTheDocument()
  })
})

// ─── NumberDisplayWidget ──────────────────────────────────────────────────────

describe('NumberDisplayWidget', () => {
  beforeEach(() => {
    useTelemetryStore.getState().clearAll()
  })

  it('renders with default config (no deviceId) — shows 0.00', () => {
    render(
      <NumberDisplayWidget widgetId="w1" config={makeConfig()} isEditing={false} />
    )
    expect(screen.getByText('0.00')).toBeInTheDocument()
  })

  it('renders telemetry value formatted to configured decimals', () => {
    act(() => {
      useTelemetryStore.getState().setTelemetry('device-1', 'sensor', 12.3456, Date.now())
    })
    render(
      <NumberDisplayWidget widgetId="w1" config={withDevice({ decimals: 1 })} isEditing={false} />
    )
    expect(screen.getByText('12.3')).toBeInTheDocument()
  })

  it('renders prefix and suffix from settings', () => {
    render(
      <NumberDisplayWidget
        widgetId="w1"
        config={makeConfig({ settings: { prefix: '$', suffix: '/h', decimals: 0 } })}
        isEditing={false}
      />
    )
    // prefix and suffix render as inline text nodes inside the same element
    const container = screen.getByText(/\$.*\/h/, { selector: 'div' })
    expect(container).toBeInTheDocument()
  })

  it('renders unit label below value', () => {
    render(
      <NumberDisplayWidget
        widgetId="w1"
        config={makeConfig({ settings: { unit: 'kWh' } })}
        isEditing={false}
      />
    )
    expect(screen.getByText('kWh')).toBeInTheDocument()
  })
})

// ─── StatusIndicatorWidget ────────────────────────────────────────────────────

describe('StatusIndicatorWidget', () => {
  beforeEach(() => {
    useTelemetryStore.getState().clearAll()
  })

  it('renders OFF state when no telemetry (default)', () => {
    render(
      <StatusIndicatorWidget widgetId="w1" config={makeConfig()} isEditing={false} />
    )
    expect(screen.getByText('OFF')).toBeInTheDocument()
  })

  it('renders ON state when telemetry matches onValue', () => {
    act(() => {
      useTelemetryStore.getState().setTelemetry('device-1', 'sensor', '1', Date.now())
    })
    render(
      <StatusIndicatorWidget
        widgetId="w1"
        config={withDevice({ onValue: '1' })}
        isEditing={false}
      />
    )
    expect(screen.getByText('ON')).toBeInTheDocument()
  })

  it('shows custom on/off labels from settings', () => {
    render(
      <StatusIndicatorWidget
        widgetId="w1"
        config={makeConfig({ settings: { onLabel: 'Running', offLabel: 'Stopped' } })}
        isEditing={false}
      />
    )
    expect(screen.getByText('Stopped')).toBeInTheDocument()
  })
})

// ─── StatCardWidget ───────────────────────────────────────────────────────────

describe('StatCardWidget', () => {
  beforeEach(() => {
    useTelemetryStore.getState().clearAll()
  })

  it('renders with default config (no deviceId) — shows 0.0', () => {
    render(
      <StatCardWidget widgetId="w1" config={makeConfig()} isEditing={false} />
    )
    expect(screen.getByText('0.0')).toBeInTheDocument()
  })

  it('renders telemetry value from store', () => {
    act(() => {
      useTelemetryStore.getState().setTelemetry('device-1', 'sensor', 99, Date.now())
    })
    render(
      <StatCardWidget widgetId="w1" config={withDevice()} isEditing={false} />
    )
    expect(screen.getByText('99.0')).toBeInTheDocument()
  })

  it('renders unit from settings', () => {
    render(
      <StatCardWidget
        widgetId="w1"
        config={makeConfig({ settings: { unit: 'rpm' } })}
        isEditing={false}
      />
    )
    expect(screen.getByText('rpm')).toBeInTheDocument()
  })

  it('shows trend indicator ("vs prev" text)', () => {
    render(
      <StatCardWidget widgetId="w1" config={makeConfig()} isEditing={false} />
    )
    expect(screen.getByText('vs prev')).toBeInTheDocument()
  })
})

// ─── ProgressBarWidget ────────────────────────────────────────────────────────

describe('ProgressBarWidget', () => {
  beforeEach(() => {
    useTelemetryStore.getState().clearAll()
  })

  it('renders with default config — shows 0.0 and 0%', () => {
    render(
      <ProgressBarWidget widgetId="w1" config={makeConfig()} isEditing={false} />
    )
    expect(screen.getByText(/0\.0/)).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('renders telemetry value and computes percentage', () => {
    act(() => {
      useTelemetryStore.getState().setTelemetry('device-1', 'sensor', 75, Date.now())
    })
    render(
      <ProgressBarWidget
        widgetId="w1"
        config={withDevice({ min: 0, max: 100 })}
        isEditing={false}
      />
    )
    expect(screen.getByText(/75\.0/)).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('renders min/max range labels', () => {
    render(
      <ProgressBarWidget
        widgetId="w1"
        config={makeConfig({ settings: { min: 20, max: 80 } })}
        isEditing={false}
      />
    )
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
  })

  it('clamps progress bar to 0% when value is below min', () => {
    act(() => {
      useTelemetryStore.getState().setTelemetry('device-1', 'sensor', -10, Date.now())
    })
    render(
      <ProgressBarWidget
        widgetId="w1"
        config={withDevice({ min: 0, max: 100 })}
        isEditing={false}
      />
    )
    expect(screen.getByText('0%')).toBeInTheDocument()
  })
})

// ─── LineChartWidget ──────────────────────────────────────────────────────────

describe('LineChartWidget', () => {
  it('renders "No datastream configured" when no deviceId', () => {
    render(
      <LineChartWidget widgetId="w1" config={makeConfig()} isEditing={false} />
    )
    expect(screen.getByText('No datastream configured')).toBeInTheDocument()
  })

  it('renders chart container when deviceId and datastreamKey are set', () => {
    render(
      <LineChartWidget widgetId="w1" config={withDevice()} isEditing={false} />
    )
    // recharts is mocked — the container should appear
    expect(screen.getByTestId('recharts-linechart')).toBeInTheDocument()
  })
})

// ─── MapWidget ────────────────────────────────────────────────────────────────

describe('MapWidget', () => {
  it('renders "No device configured" when deviceId is null', () => {
    render(
      <MapWidget widgetId="w1" config={makeConfig()} isEditing={false} />
    )
    expect(screen.getByText('No device configured')).toBeInTheDocument()
  })

  it('renders map container div when deviceId is set', () => {
    // Leaflet is mocked so no real map loads; just verify the container renders
    render(
      <MapWidget widgetId="w1" config={withDevice()} isEditing={false} />
    )
    // The fallback text should NOT appear
    expect(screen.queryByText('No device configured')).not.toBeInTheDocument()
  })
})
