import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// ─── Mock components needed by WidgetRenderer ─────────────────────────────────
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}))

vi.mock('@/stores/widgetConfigStore', () => ({
  useWidgetConfigStore: (selector: (s: { openConfig: () => void }) => unknown) =>
    selector({ openConfig: vi.fn() }),
}))

import { WIDGET_REGISTRY, getWidgetDef, WIDGET_TYPES } from '@/features/widgets/registry'
import { WidgetRenderer } from '@/features/widgets/WidgetRenderer'
import type { WidgetDefinition, WidgetProps, ConfigFieldsProps } from '@/features/widgets/types'

// ─── Custom widget for extension test ────────────────────────────────────────
const CustomGauge = ({ config }: WidgetProps) => (
  <div data-testid="custom-gauge-widget">Custom: {config.name}</div>
)

const CustomGaugeConfig = ({ settings: _settings, onChange: _onChange }: ConfigFieldsProps) => (
  <div data-testid="custom-gauge-config" />
)

const CUSTOM_WIDGET_DEF: WidgetDefinition = {
  type: 'custom_gauge',
  label: 'Custom Gauge',
  icon: 'Activity',
  defaultSize: { w: 4, h: 3 },
  defaultConfig: { min: 0, max: 200, unit: 'psi' },
  component: CustomGauge,
  configFields: CustomGaugeConfig,
}

const makeEntry = (widgetType: string) => ({
  i: 'test-widget',
  x: 0, y: 0, w: 4, h: 3,
  widgetType,
  config: {
    name: 'Test Widget',
    deviceId: null,
    datastreamKey: null,
    settings: {},
  },
})

describe('Widget Registry Extension (AD-DASH-002)', () => {
  // Clean up any registry additions after each test
  afterEach(() => {
    delete WIDGET_REGISTRY['custom_gauge']
  })

  it('can add a new widget type to the registry at runtime', () => {
    const initialCount = Object.keys(WIDGET_REGISTRY).length

    // Add new widget type
    WIDGET_REGISTRY['custom_gauge'] = CUSTOM_WIDGET_DEF

    expect(Object.keys(WIDGET_REGISTRY)).toHaveLength(initialCount + 1)
    expect(WIDGET_REGISTRY['custom_gauge']).toBeDefined()
  })

  it('getWidgetDef returns the newly registered definition', () => {
    WIDGET_REGISTRY['custom_gauge'] = CUSTOM_WIDGET_DEF

    const def = getWidgetDef('custom_gauge')
    expect(def).toBeDefined()
    expect(def?.type).toBe('custom_gauge')
    expect(def?.label).toBe('Custom Gauge')
    expect(def?.defaultSize).toEqual({ w: 4, h: 3 })
  })

  it('WidgetRenderer renders the new custom widget type', () => {
    WIDGET_REGISTRY['custom_gauge'] = CUSTOM_WIDGET_DEF

    render(
      <WidgetRenderer entry={makeEntry('custom_gauge')} isEditing={false} />
    )

    expect(screen.getByTestId('custom-gauge-widget')).toBeInTheDocument()
    expect(screen.getByText('Custom: Test Widget')).toBeInTheDocument()
  })

  it('WidgetRenderer shows error placeholder for unknown widget type', () => {
    render(
      <WidgetRenderer entry={makeEntry('does_not_exist')} isEditing={false} />
    )

    expect(screen.getByText(/Unknown widget type/i)).toBeInTheDocument()
    expect(screen.getByText('does_not_exist')).toBeInTheDocument()
  })

  it('extension does not break existing 9 registered widgets', () => {
    WIDGET_REGISTRY['custom_gauge'] = CUSTOM_WIDGET_DEF

    const allTypes = Object.keys(WIDGET_REGISTRY)
    const originalTypes = [
      'gauge', 'number_display', 'line_chart', 'status_indicator',
      'toggle_switch', 'button', 'stat_card', 'progress_bar', 'map',
    ]

    for (const type of originalTypes) {
      expect(allTypes).toContain(type)
    }
  })

  it('WIDGET_TYPES reflects base 9 types (before runtime extension)', () => {
    // WIDGET_TYPES is computed once at module load from Object.values(WIDGET_REGISTRY)
    // Extensions after load do NOT reflect in WIDGET_TYPES (it's a snapshot)
    expect(WIDGET_TYPES).toHaveLength(9)
  })

  it('newly registered widget has valid definition shape', () => {
    WIDGET_REGISTRY['custom_gauge'] = CUSTOM_WIDGET_DEF

    const def = getWidgetDef('custom_gauge')!

    expect(typeof def.type).toBe('string')
    expect(typeof def.label).toBe('string')
    expect(typeof def.icon).toBe('string')
    expect(typeof def.component).toBe('function')
    expect(typeof def.configFields).toBe('function')
    expect(typeof def.defaultSize.w).toBe('number')
    expect(typeof def.defaultSize.h).toBe('number')
    expect(typeof def.defaultConfig).toBe('object')
  })
})
