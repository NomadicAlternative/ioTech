import api from '@/lib/axios'
import type { Client, PaginationMeta } from '@/features/widgets/types'

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface CreateClientPayload {
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  metadata?: Record<string, unknown> | null
}

export type UpdateClientPayload = Partial<CreateClientPayload>

// ─── Transform ────────────────────────────────────────────────────────────────

function camelizeClient(raw: Record<string, unknown>): Client {
  return {
    id: raw.id as string,
    tenantId: raw.tenant_id as string | undefined,
    name: raw.name as string,
    email: (raw.email ?? null) as string | null,
    phone: (raw.phone ?? null) as string | null,
    address: (raw.address ?? null) as string | null,
    metadata: (raw.metadata ?? null) as Record<string, unknown> | null,
    createdAt: raw.created_at as string | undefined,
    updatedAt: raw.updated_at as string | undefined,
  }
}

// ─── Clients ──────────────────────────────────────────────────────────────────

export async function listClients(
  page = 1,
  limit = 10,
  search?: string
): Promise<{ data: Client[]; meta: PaginationMeta }> {
  const res = await api.get<{ data: Record<string, unknown>[]; meta: PaginationMeta }>(
    '/api/clients',
    { params: { page, limit, ...(search ? { search } : {}) } }
  )
  return { data: res.data.data.map(camelizeClient), meta: res.data.meta }
}

export async function getClient(id: string): Promise<Client> {
  const res = await api.get<{ data: Record<string, unknown> }>(`/api/clients/${id}`)
  return camelizeClient(res.data.data)
}

export async function createClient(data: CreateClientPayload): Promise<Client> {
  const res = await api.post<{ data: Record<string, unknown> }>('/api/clients', data)
  return camelizeClient(res.data.data)
}

export async function updateClient(id: string, data: UpdateClientPayload): Promise<Client> {
  const res = await api.put<{ data: Record<string, unknown> }>(`/api/clients/${id}`, data)
  return camelizeClient(res.data.data)
}

export async function deleteClient(id: string): Promise<void> {
  await api.delete(`/api/clients/${id}`)
}
