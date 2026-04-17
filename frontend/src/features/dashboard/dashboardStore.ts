import { create } from 'zustand'
import { debounce } from '@/lib/debounce'
import type { Dashboard, WidgetLayoutEntry } from '@/features/widgets/types'
import * as dashboardApi from './api'

interface DashboardState {
  dashboards: Dashboard[]
  currentDashboard: Dashboard | null
  layout: WidgetLayoutEntry[]
  isEditing: boolean
  isSaving: boolean
  saveError: string | null
}

interface DashboardActions {
  fetchDashboards: () => Promise<void>
  fetchDashboard: (id: string) => Promise<void>
  createDashboard: (name: string, description: string) => Promise<Dashboard>
  updateDashboard: (id: string, data: Partial<Pick<Dashboard, 'name' | 'description'>>) => Promise<void>
  deleteDashboard: (id: string) => Promise<void>
  setLayout: (layout: WidgetLayoutEntry[]) => void
  saveLayout: () => void
  setIsEditing: (isEditing: boolean) => void
  clearCurrent: () => void
}

type DashboardStore = DashboardState & DashboardActions

// Debounced internal save — will be replaced per-store instance
let debouncedSave: (() => void) | null = null

export const useDashboardStore = create<DashboardStore>((set, get) => {
  // Build debounced save referencing `get` via closure
  const _performSave = async () => {
    const { currentDashboard, layout } = get()
    if (!currentDashboard) return
    set({ isSaving: true, saveError: null })
    try {
      await dashboardApi.saveLayout(currentDashboard.id, layout)
      set({ isSaving: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed'
      set({ isSaving: false, saveError: message })
    }
  }

  debouncedSave = debounce(_performSave, 1500)

  return {
    // ─── State ──────────────────────────────────────────────────────────
    dashboards: [],
    currentDashboard: null,
    layout: [],
    isEditing: false,
    isSaving: false,
    saveError: null,

    // ─── Actions ─────────────────────────────────────────────────────────
    fetchDashboards: async () => {
      const dashboards = await dashboardApi.fetchDashboards()
      set({ dashboards })
    },

    fetchDashboard: async (id: string) => {
      const dashboard = await dashboardApi.fetchDashboard(id)
      set({ currentDashboard: dashboard, layout: dashboard.layout ?? [] })
    },

    createDashboard: async (name, description) => {
      const dashboard = await dashboardApi.createDashboard(name, description)
      set((state) => ({ dashboards: [dashboard, ...state.dashboards] }))
      return dashboard
    },

    updateDashboard: async (id, data) => {
      const updated = await dashboardApi.updateDashboard(id, data)
      set((state) => ({
        dashboards: state.dashboards.map((d) => (d.id === id ? updated : d)),
        currentDashboard: state.currentDashboard?.id === id ? updated : state.currentDashboard,
      }))
    },

    deleteDashboard: async (id) => {
      await dashboardApi.deleteDashboard(id)
      set((state) => ({
        dashboards: state.dashboards.filter((d) => d.id !== id),
        currentDashboard: state.currentDashboard?.id === id ? null : state.currentDashboard,
      }))
    },

    setLayout: (layout: WidgetLayoutEntry[]) => {
      set({ layout })
      debouncedSave?.()
    },

    saveLayout: () => {
      debouncedSave?.()
    },

    setIsEditing: (isEditing: boolean) => set({ isEditing }),

    clearCurrent: () => set({ currentDashboard: null, layout: [], isEditing: false }),
  }
})
