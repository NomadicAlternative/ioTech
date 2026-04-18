import { create } from 'zustand'

/**
 * Tracks which widget's config panel is currently open in the dashboard editor.
 * Only one panel can be open at a time.
 */
interface WidgetConfigState {
  editingWidgetId: string | null
  isOpen: boolean
}

interface WidgetConfigActions {
  /** Open the config panel for the given widget ID. */
  openConfig: (widgetId: string) => void
  /** Close the panel (keeps editingWidgetId until `clear` is called). */
  closeConfig: () => void
  /** Reset both id and open state — call on editor unmount. */
  clear: () => void
}

type WidgetConfigStore = WidgetConfigState & WidgetConfigActions

/**
 * Zustand store for widget config panel state.
 *
 * @example
 * const { openConfig, isOpen } = useWidgetConfigStore()
 */
export const useWidgetConfigStore = create<WidgetConfigStore>((set) => ({
  editingWidgetId: null,
  isOpen: false,

  openConfig: (widgetId) => set({ editingWidgetId: widgetId, isOpen: true }),
  closeConfig: () => set({ isOpen: false }),
  clear: () => set({ editingWidgetId: null, isOpen: false }),
}))
