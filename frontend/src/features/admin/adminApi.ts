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

export async function createTenant(data: CreateTenantPayload): Promise<{ tenant: Tenant; credentials: { email: string; password: string } }> {
  const res = await api.post<{ data: { tenant: Tenant; credentials: { email: string; password: string } } }>('/api/admin/tenants', data)
  return res.data.data
}

export async function resetPassword(tenantId: string, password: string): Promise<{ email: string; password: string }> {
  const res = await api.post<{ data: { email: string; password: string } }>(`/api/admin/tenants/${tenantId}/reset-password`, { password })
  return res.data.data
}
