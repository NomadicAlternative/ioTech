import api from '@/lib/axios'

export interface Tenant {
  id: string
  name: string
  email: string
  contact_email?: string | null
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateTenantPayload {
  name: string
  email: string
  password: string
}

export async function fetchTenants(): Promise<Tenant[]> {
  const res = await api.get<{ data: Tenant[] }>('/api/admin/tenants')
  return res.data.data
}

export async function createTenant(data: CreateTenantPayload): Promise<{ tenant: Tenant; user: Record<string, unknown> }> {
  const res = await api.post<{ data: { tenant: Tenant; user: Record<string, unknown> } }>('/api/admin/tenants', data)
  return res.data.data
}
