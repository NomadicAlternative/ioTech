import api from '@/lib/axios'
import type { Device, Client, PaginationMeta } from '@/features/widgets/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Device is considered online if last_seen is within the last 90 seconds */
function computeIsOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < 90_000
}

function withOnlineStatus(device: Device): Device {
  return { ...device, isOnline: computeIsOnline(device.lastSeen) }
}

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
  search?: string,
  status?: string
): Promise<{ data: Device[]; meta: PaginationMeta }> {
  const res = await api.get<{ data: Device[]; meta: PaginationMeta }>('/api/devices', {
    params: { page, limit, ...(search ? { search } : {}), ...(status ? { status } : {}) },
  })
  return { ...res.data, data: res.data.data.map(withOnlineStatus) }
}

export async function getDevice(id: string): Promise<Device> {
  const res = await api.get<{ data: Device }>(`/api/devices/${id}`)
  return withOnlineStatus(res.data.data)
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
  relay: number,
  state: 'on' | 'off'
): Promise<void> {
  await api.post(`/api/devices/${deviceId}/command`, { relay, state })
}

export interface ProvisioningCredentials {
  device_token: string
  claim_token?: string
  tenant_id: string
  device_id: string
  backend_url: string
  mqtt_url: string
  mqtt_username?: string
  mqtt_password?: string
  drivers?: { model: string; gpio?: number; channels?: { num: number; gpio: number; name: string }[] }[]
}

export async function getProvisioningCredentials(deviceId: string): Promise<ProvisioningCredentials> {
  const res = await api.get<{ data: ProvisioningCredentials }>(`/api/devices/${deviceId}/provisioning-credentials`)
  return res.data.data
}

// ─── Templates & Clients (for dropdowns) ─────────────────────────────────────

export { listTemplatesFlat as listTemplates, getTemplate as fetchDeviceTemplate } from '@/features/templates/api'

export async function listClients(): Promise<Client[]> {
  const res = await api.get<{ data: Client[] }>('/api/clients')
  return res.data.data
}
