import type React from 'react'

// ─── Core widget data types ───────────────────────────────────────────────────

/**
 * Per-widget configuration stored inside `WidgetLayoutEntry.config`.
 * Saved as part of the layout JSONB in the `dashboards` table (AD-DASH-005).
 */
export interface WidgetConfig {
  /** Displayed as the widget's header label. Defaults to widget type name. */
  name: string
  deviceId: string | null
  datastreamKey: string | null
  /** Type-specific settings (e.g. min/max for Gauge, period for LineChart). */
  settings: Record<string, unknown>
}

/**
 * A single entry in the dashboard layout array.
 * Combines react-grid-layout positional data with widget type and config.
 */
export interface WidgetLayoutEntry {
  i: string           // uuid — react-grid-layout key
  x: number
  y: number
  w: number
  h: number
  widgetType: string
  config: WidgetConfig
}

// ─── Widget component contracts ───────────────────────────────────────────────

/** Props received by every widget display component. */
export interface WidgetProps {
  widgetId: string
  config: WidgetConfig
  isEditing: boolean
}

/** Props received by every widget config-fields component rendered inside `WidgetConfigPanel`. */
export interface ConfigFieldsProps {
  settings: Record<string, unknown>
  onChange: (settings: Record<string, unknown>) => void
  /** Optional callback — widget config fields call this with `false` when there's a validation error. */
  onValidChange?: (isValid: boolean) => void
}

/**
 * A single entry in the `WIDGET_REGISTRY`.
 * Adding one entry here (+ one component file) is all that's needed to register a new widget type.
 */
export interface WidgetDefinition {
  type: string
  label: string
  icon: string  // lucide-react icon name
  defaultSize: { w: number; h: number }
  defaultConfig: Record<string, unknown>
  component: React.ComponentType<WidgetProps>
  configFields: React.ComponentType<ConfigFieldsProps>
}

// ─── Dashboard API types ──────────────────────────────────────────────────────

export interface Dashboard {
  id: string
  name: string
  description: string | null
  layout: WidgetLayoutEntry[]
  ownerId: string
  isShared: boolean
  widgetCount: number
  updatedAt: string
  createdAt: string
}

export interface Device {
  id: string
  name: string
  templateId: string | null
  clientId: string | null
  status: string
  isOnline: boolean
  lastSeen: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface Client {
  id: string
  tenantId?: string
  name: string
  email: string | null
  phone?: string | null
  address?: string | null
  metadata?: Record<string, unknown> | null
  createdAt?: string
  updatedAt?: string
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface Datastream {
  key: string
  name: string
  type: string
  direction?: string
  unit?: string
  min?: number
  max?: number
}

export interface DeviceTemplate {
  id: string
  name: string
  description?: string
  datastreams: Datastream[]
}
