import api from '@/lib/axios'
import type { DeviceTemplate, PaginationMeta, Datastream } from '@/features/widgets/types'

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface CreateTemplatePayload {
  name: string
  description?: string
  datastreams: Datastream[]
}

export type UpdateTemplatePayload = Partial<CreateTemplatePayload>

// ─── Templates ────────────────────────────────────────────────────────────────

export async function listTemplates(
  page = 1,
  limit = 10,
  search?: string
): Promise<{ data: DeviceTemplate[]; meta: PaginationMeta }> {
  const res = await api.get<{ data: DeviceTemplate[]; meta: PaginationMeta }>(
    '/api/device-templates',
    { params: { page, limit, ...(search ? { search } : {}) } }
  )
  return res.data
}

export async function listTemplatesFlat(): Promise<DeviceTemplate[]> {
  const res = await api.get<{ data: DeviceTemplate[] }>('/api/device-templates')
  return res.data.data
}

export async function getTemplate(id: string): Promise<DeviceTemplate> {
  const res = await api.get<{ data: DeviceTemplate }>(`/api/device-templates/${id}`)
  return res.data.data
}

export async function createTemplate(data: CreateTemplatePayload): Promise<DeviceTemplate> {
  const res = await api.post<{ data: DeviceTemplate }>('/api/device-templates', data)
  return res.data.data
}

export async function updateTemplate(
  id: string,
  data: UpdateTemplatePayload
): Promise<DeviceTemplate> {
  const res = await api.put<{ data: DeviceTemplate }>(`/api/device-templates/${id}`, data)
  return res.data.data
}

export async function deleteTemplate(id: string): Promise<void> {
  await api.delete(`/api/device-templates/${id}`)
}
