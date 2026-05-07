import { create } from 'zustand'
import { fetchTenants, createTenant, type Tenant, type CreateTenantPayload } from './adminApi'

interface AdminStore {
  tenants: Tenant[]
  loading: boolean
  error: string | null
  fetchTenants: () => Promise<void>
  addTenant: (payload: CreateTenantPayload) => Promise<{ email: string; password: string }>
}

export const useAdminStore = create<AdminStore>((set) => ({
  tenants: [],
  loading: false,
  error: null,

  fetchTenants: async () => {
    set({ loading: true, error: null })
    try {
      const data = await fetchTenants()
      set({ tenants: data, loading: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load', loading: false })
    }
  },

  addTenant: async (payload) => {
    set({ error: null })
    const result = await createTenant(payload)
    const data = await fetchTenants()
    set({ tenants: data })
    return result.credentials
  },
}))
