import api from '@/lib/axios'
import type { Dashboard, WidgetLayoutEntry, Device, DeviceTemplate } from '@/features/widgets/types'

// ─── Dashboards ───────────────────────────────────────────────────────────────

export async function fetchDashboards(): Promise<Dashboard[]> {
  const res = await api.get<Dashboard[]>('/api/dashboards')
  return res.data
}

export async function fetchDashboard(id: string): Promise<Dashboard> {
  const res = await api.get<Dashboard>(`/api/dashboards/${id}`)
  return res.data
}

export async function createDashboard(
  name: string,
  description: string
): Promise<Dashboard> {
  const res = await api.post<Dashboard>('/api/dashboards', { name, description })
  return res.data
}

export async function updateDashboard(
  id: string,
  data: Partial<Pick<Dashboard, 'name' | 'description'>>
): Promise<Dashboard> {
  const res = await api.put<Dashboard>(`/api/dashboards/${id}`, data)
  return res.data
}

export async function deleteDashboard(id: string): Promise<void> {
  await api.delete(`/api/dashboards/${id}`)
}

export async function saveLayout(
  id: string,
  layout: WidgetLayoutEntry[]
): Promise<void> {
  await api.put(`/api/dashboards/${id}/layout`, { layout })
}

// ─── Sharing ──────────────────────────────────────────────────────────────────

export async function shareDashboard(
  dashboardId: string,
  clientId: string
): Promise<void> {
  await api.post(`/api/dashboards/${dashboardId}/share`, { clientId })
}

export async function revokeDashboardShare(
  dashboardId: string,
  clientId: string
): Promise<void> {
  await api.delete(`/api/dashboards/${dashboardId}/share/${clientId}`)
}

export async function fetchDashboardSharedClients(dashboardId: string): Promise<string[]> {
  const res = await api.get<string[]>(`/api/dashboards/${dashboardId}/share`)
  return res.data
}

// ─── Devices ──────────────────────────────────────────────────────────────────

export async function fetchDevices(): Promise<Device[]> {
  const res = await api.get<Device[]>('/api/devices')
  return res.data
}

export async function fetchDeviceTemplate(templateId: string): Promise<DeviceTemplate> {
  const res = await api.get<DeviceTemplate>(`/api/device-templates/${templateId}`)
  return res.data
}

// ─── Clients ──────────────────────────────────────────────────────────────────

export async function fetchClients(): Promise<{ id: string; name: string; email: string }[]> {
  const res = await api.get<{ id: string; name: string; email: string }[]>('/api/clients')
  return res.data
}

// ─── Telemetry history ────────────────────────────────────────────────────────

export async function fetchTelemetryHistory(
  deviceId: string,
  datastreamKey: string,
  limit = 100
): Promise<{ value: number; timestamp: string }[]> {
  const res = await api.get<{ value: number; timestamp: string }[]>(
    `/api/devices/${deviceId}/telemetry`,
    { params: { datastreamKey, limit } }
  )
  return res.data
}

// ─── Device commands ──────────────────────────────────────────────────────────

export async function sendDeviceCommand(
  deviceId: string,
  action: string,
  payload?: unknown
): Promise<void> {
  await api.post(`/api/devices/${deviceId}/command`, { action, payload })
}
