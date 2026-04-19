import { create } from 'zustand'
import type { DeviceTemplate, PaginationMeta } from '@/features/widgets/types'
import * as templateApi from './api'
import type { CreateTemplatePayload, UpdateTemplatePayload } from './api'

// ─── State & Actions ──────────────────────────────────────────────────────────

interface TemplateState {
  templates: DeviceTemplate[]
  pagination: PaginationMeta
  search: string
  loading: boolean
  error: string | null
}

interface TemplateActions {
  fetchTemplates: (page?: number, limit?: number, search?: string) => Promise<void>
  createTemplate: (data: CreateTemplatePayload) => Promise<DeviceTemplate>
  updateTemplate: (id: string, data: UpdateTemplatePayload) => Promise<void>
  deleteTemplate: (id: string) => Promise<void>
  setPage: (page: number) => void
  setSearch: (search: string) => void
}

type TemplateStore = TemplateState & TemplateActions

const DEFAULT_PAGINATION: PaginationMeta = { page: 1, limit: 10, total: 0, totalPages: 1 }

/**
 * Zustand store for template CRUD and server-side pagination.
 *
 * @example
 * const { templates, fetchTemplates, pagination } = useTemplateStore()
 */
export const useTemplateStore = create<TemplateStore>((set, get) => ({
  // ─── State ────────────────────────────────────────────────────────────────
  templates: [],
  pagination: DEFAULT_PAGINATION,
  search: '',
  loading: false,
  error: null,

  // ─── Actions ──────────────────────────────────────────────────────────────
  fetchTemplates: async (page, limit, search) => {
    const { pagination, search: storedSearch } = get()
    const resolvedPage = page ?? pagination.page
    const resolvedLimit = limit ?? pagination.limit
    const resolvedSearch = search !== undefined ? search : storedSearch

    set({ loading: true, error: null })
    try {
      const result = await templateApi.listTemplates(
        resolvedPage,
        resolvedLimit,
        resolvedSearch || undefined
      )
      set({ templates: result.data, pagination: result.meta, loading: false })
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Error al cargar plantillas',
      })
    }
  },

  createTemplate: async (data: CreateTemplatePayload) => {
    set({ loading: true, error: null })
    try {
      const template = await templateApi.createTemplate(data)
      set((state) => ({ templates: [template, ...state.templates], loading: false }))
      return template
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Error al crear plantilla' })
      throw err
    }
  },

  updateTemplate: async (id: string, data: UpdateTemplatePayload) => {
    set({ loading: true, error: null })
    try {
      const updated = await templateApi.updateTemplate(id, data)
      set((state) => ({
        templates: state.templates.map((t) => (t.id === id ? updated : t)),
        loading: false,
      }))
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Error al actualizar plantilla',
      })
      throw err
    }
  },

  deleteTemplate: async (id: string) => {
    set({ loading: true, error: null })
    try {
      await templateApi.deleteTemplate(id)
      set((state) => ({
        templates: state.templates.filter((t) => t.id !== id),
        loading: false,
      }))
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Error al eliminar plantilla',
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
