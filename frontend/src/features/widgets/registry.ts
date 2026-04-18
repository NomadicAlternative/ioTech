import type { WidgetDefinition } from './types'
import { GaugeWidget, GaugeConfigFields } from './types/GaugeWidget'
import { NumberDisplayWidget, NumberDisplayConfigFields } from './types/NumberDisplayWidget'
import { LineChartWidget, LineChartConfigFields } from './types/LineChartWidget'
import { StatusIndicatorWidget, StatusIndicatorConfigFields } from './types/StatusIndicatorWidget'
import { ToggleSwitchWidget, ToggleSwitchConfigFields } from './types/ToggleSwitchWidget'
import { ButtonWidget, ButtonConfigFields } from './types/ButtonWidget'
import { StatCardWidget, StatCardConfigFields } from './types/StatCardWidget'
import { ProgressBarWidget, ProgressBarConfigFields } from './types/ProgressBarWidget'
import { MapWidget, MapConfigFields } from './types/MapWidget'

/**
 * Central widget registry — maps widget type keys to their definitions.
 *
 * **Extensibility rule (REQ-DASH-036 / SC-DASH-039)**:
 * Adding a new widget type requires ONLY:
 * 1. One component file in `types/` (exporting `<Type>Widget` + `<Type>ConfigFields`)
 * 2. One entry in this map
 *
 * No other files need to be modified.
 */
export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
  gauge: {
    type: 'gauge',
    label: 'Gauge',
    icon: 'Gauge',
    defaultSize: { w: 3, h: 3 },
    defaultConfig: { min: 0, max: 100, unit: '' },
    component: GaugeWidget,
    configFields: GaugeConfigFields,
  },
  number_display: {
    type: 'number_display',
    label: 'Number Display',
    icon: 'Hash',
    defaultSize: { w: 2, h: 2 },
    defaultConfig: { unit: '', decimals: 2, prefix: '', suffix: '' },
    component: NumberDisplayWidget,
    configFields: NumberDisplayConfigFields,
  },
  line_chart: {
    type: 'line_chart',
    label: 'Line Chart',
    icon: 'TrendingUp',
    defaultSize: { w: 6, h: 3 },
    defaultConfig: { period: '24h', color: '#3b82f6', showGrid: true },
    component: LineChartWidget,
    configFields: LineChartConfigFields,
  },
  status_indicator: {
    type: 'status_indicator',
    label: 'Status Indicator',
    icon: 'Circle',
    defaultSize: { w: 2, h: 2 },
    defaultConfig: { onValue: '1', onColor: '#22c55e', offColor: '#ef4444', onLabel: 'ON', offLabel: 'OFF' },
    component: StatusIndicatorWidget,
    configFields: StatusIndicatorConfigFields,
  },
  toggle_switch: {
    type: 'toggle_switch',
    label: 'Toggle Switch',
    icon: 'ToggleLeft',
    defaultSize: { w: 2, h: 2 },
    defaultConfig: { onCommand: 'on', offCommand: 'off', onValue: '1' },
    component: ToggleSwitchWidget,
    configFields: ToggleSwitchConfigFields,
  },
  button: {
    type: 'button',
    label: 'Button',
    icon: 'MousePointerClick',
    defaultSize: { w: 2, h: 2 },
    defaultConfig: { action: 'trigger', payload: null, label: 'Send', variant: 'default' },
    component: ButtonWidget,
    configFields: ButtonConfigFields,
  },
  stat_card: {
    type: 'stat_card',
    label: 'Stat Card',
    icon: 'BarChart2',
    defaultSize: { w: 3, h: 2 },
    defaultConfig: { unit: '' },
    component: StatCardWidget,
    configFields: StatCardConfigFields,
  },
  progress_bar: {
    type: 'progress_bar',
    label: 'Progress Bar',
    icon: 'AlignLeft',
    defaultSize: { w: 4, h: 2 },
    defaultConfig: { min: 0, max: 100, unit: '', color: '#3b82f6' },
    component: ProgressBarWidget,
    configFields: ProgressBarConfigFields,
  },
  map: {
    type: 'map',
    label: 'Map',
    icon: 'MapPin',
    defaultSize: { w: 6, h: 4 },
    defaultConfig: { latDatastreamKey: 'lat', lngDatastreamKey: 'lng', zoom: 13 },
    component: MapWidget,
    configFields: MapConfigFields,
  },
}

/** Retrieve a widget definition by type key. Returns undefined for unknown types. */
export function getWidgetDef(type: string): WidgetDefinition | undefined {
  return WIDGET_REGISTRY[type]
}

/** Ordered list of all registered widget definitions — used by the widget picker in the editor. */
export const WIDGET_TYPES: WidgetDefinition[] = Object.values(WIDGET_REGISTRY)
