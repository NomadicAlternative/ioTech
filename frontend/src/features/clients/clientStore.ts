import { create } from 'zustand'
import type { Client, PaginationMeta } from '@/features/widgets/types'
import * as clientApi from './api'
import type { CreateClientPayload, UpdateClientPayload } from './api'

// ─── State & Actions ──────────────────────────────────────────────────────────

interface ClientState {
  clients: Client[]
  pagination: PaginationMeta
  search: string
  loading: boolean
  error: string | null
}

interface ClientActions {
  fetchClients: (page?: number, limit?: number, search?: string) => Promise<void>
  createClient: (data: CreateClientPayload) => Promise<Client>
  updateClient: (id: string, data: UpdateClientPayload) => Promise<void>
  deleteClient: (id: string) => Promise<void>
  setPage: (page: number) => void
  setSearch: (search: string) => void
}

type ClientStore = ClientState & ClientActions

const DEFAULT_PAGINATION: PaginationMeta = { page: 1, limit: 10, total: 0, totalPages: 1 }

/**
 * Zustand store for client CRUD and server-side pagination.
 *
 * @example
 * const { clients, fetchClients, pagination } = useClientStore()
 */
export const useClientStore = create<ClientStore>((set, get) => ({
  // ─── State ────────────────────────────────────────────────────────────────
  clients: [],
  pagination: DEFAULT_PAGINATION,
  search: '',
  loading: false,
  error: null,

  // ─── Actions ──────────────────────────────────────────────────────────────
  fetchClients: async (page, limit, search) => {
    const { pagination, search: storedSearch } = get()
    const resolvedPage = page ?? pagination.page
    const resolvedLimit = limit ?? pagination.limit
    const resolvedSearch = search !== undefined ? search : storedSearch

    set({ loading: true, error: null })
    try {
      const result = await clientApi.listClients(
        resolvedPage,
        resolvedLimit,
        resolvedSearch || undefined
      )
      set({ clients: result.data, pagination: result.meta, loading: false })
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Error al cargar clientes',
      })
    }
  },

  createClient: async (data: CreateClientPayload) => {
    set({ loading: true, error: null })
    try {
      const client = await clientApi.createClient(data)
      set((state) => ({ clients: [client, ...state.clients], loading: false }))
      return client
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Error al crear cliente' })
      throw err
    }
  },

  updateClient: async (id: string, data: UpdateClientPayload) => {
    set({ loading: true, error: null })
    try {
      const updated = await clientApi.updateClient(id, data)
      set((state) => ({
        clients: state.clients.map((c) => (c.id === id ? updated : c)),
        loading: false,
      }))
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Error al actualizar cliente',
      })
      throw err
    }
  },

  deleteClient: async (id: string) => {
    set({ loading: true, error: null })
    try {
      await clientApi.deleteClient(id)
      set((state) => ({
        clients: state.clients.filter((c) => c.id !== id),
        loading: false,
      }))
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Error al eliminar cliente',
      })
      throw err
    }
  },

  setPage: (page: number) => {
    set((state) => ({ pagination: { ...state.pagination, page } }))
  },

  setSearch: (search: string) => {
    set({ search })
  },
}))
