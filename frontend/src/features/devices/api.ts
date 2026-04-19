import api from '@/lib/axios'
import type { Device, Client, PaginationMeta } from '@/features/widgets/types'

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface CreateDevicePayload {
  name: string
  templateId?: string
  clientId?: string
  metadata?: Record<string, unknown>
}

export type UpdateDevicePayload = Partial<CreateDevicePayload>

// ─── Devices ──────────────────────────────────────────────────────────────────

export async function listDevices(
  page = 1,
  limit = 10,
  search?: string
): Promise<{ data: Device[]; meta: PaginationMeta }> {
  const res = await api.get<{ data: Device[]; meta: PaginationMeta }>('/api/devices', {
    params: { page, limit, ...(search ? { search } : {}) },
  })
  return res.data
}

export async function getDevice(id: string): Promise<Device> {
  const res = await api.get<{ data: Device }>(`/api/devices/${id}`)
  return res.data.data
}

export async function createDevice(data: CreateDevicePayload): Promise<Device> {
  const res = await api.post<{ data: Device }>('/api/devices', data)
  return res.data.data
}

export async function updateDevice(id: string, data: UpdateDevicePayload): Promise<Device> {
  const res = await api.put<{ data: Device }>(`/api/devices/${id}`, data)
  return res.data.data
}

export async function deleteDevice(id: string): Promise<void> {
  await api.delete(`/api/devices/${id}`)
}

export async function sendDeviceCommand(
  deviceId: string,
  action: string,
  payload?: unknown
): Promise<void> {
  await api.post(`/api/devices/${deviceId}/command`, { action, payload })
}

// ─── Templates & Clients (for dropdowns) ─────────────────────────────────────

export { listTemplatesFlat as listTemplates, getTemplate as fetchDeviceTemplate } from '@/features/templates/api'

export async function listClients(): Promise<Client[]> {
  const res = await api.get<{ data: Client[] }>('/api/clients')
  return res.data.data
}
