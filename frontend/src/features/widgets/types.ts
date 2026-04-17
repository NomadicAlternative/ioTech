import type React from 'react'

// ─── Core widget data types ───────────────────────────────────────────────────

export interface WidgetConfig {
  name: string
  deviceId: string | null
  datastreamKey: string | null
  settings: Record<string, unknown>
}

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

export interface WidgetProps {
  widgetId: string
  config: WidgetConfig
  isEditing: boolean
}

export interface ConfigFieldsProps {
  settings: Record<string, unknown>
  onChange: (settings: Record<string, unknown>) => void
}

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
  templateId: string
  status: string
}

export interface Datastream {
  key: string
  name: string
  type: string
  unit?: string
}

export interface DeviceTemplate {
  id: string
  name: string
  datastreams: Datastream[]
}
