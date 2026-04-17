import { create } from 'zustand'

interface WidgetConfigState {
  editingWidgetId: string | null
  isOpen: boolean
}

interface WidgetConfigActions {
  openConfig: (widgetId: string) => void
  closeConfig: () => void
  clear: () => void
}

type WidgetConfigStore = WidgetConfigState & WidgetConfigActions

export const useWidgetConfigStore = create<WidgetConfigStore>((set) => ({
  editingWidgetId: null,
  isOpen: false,

  openConfig: (widgetId) => set({ editingWidgetId: widgetId, isOpen: true }),
  closeConfig: () => set({ isOpen: false }),
  clear: () => set({ editingWidgetId: null, isOpen: false }),
}))
