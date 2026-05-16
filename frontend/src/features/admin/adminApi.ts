import api from '@/lib/axios'

export interface TenantClient {
  id: string
  name: string
  email: string
}

export interface Tenant {
  id: string
  name: string
  email: string
  adminEmail?: string | null
  contact_email?: string | null
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
  status?: string
  plan?: string
  trial_ends_at?: string | null
  clients?: TenantClient[]
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

export interface DashboardKpi {
  totalUsers: number
  totalDevices: number
  activeDevices: number
  totalTenants: number
}

export interface TenantDetail {
  id: string
  name: string
  email: string
  deviceCount: number
  userCount: number
  trialStatus: string
  trialEndsAt: string | null
  createdAt: string
}

export async function fetchDashboard(): Promise<DashboardKpi> {
  const res = await api.get<{ data: DashboardKpi }>('/api/admin/dashboard')
  return res.data.data
}

export async function fetchTenantDetail(id: string): Promise<TenantDetail> {
  const res = await api.get<{ data: TenantDetail }>(`/api/admin/tenants/${id}`)
  return res.data.data
}

export async function deleteTenant(id: string): Promise<{ deleted: boolean; summary: Record<string, number> }> {
  const res = await api.delete<{ data: { deleted: boolean; summary: Record<string, number> } }>(`/api/admin/tenants/${id}`)
  return res.data.data
}
