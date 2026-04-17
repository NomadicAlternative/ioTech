import { create } from 'zustand'

interface TelemetryEntry {
  value: unknown
  ts: number
}

interface TelemetryState {
  data: Record<string, TelemetryEntry>
}

interface TelemetryActions {
  setTelemetry: (deviceId: string, datastreamKey: string, value: unknown, ts: number) => void
  getTelemetry: (key: string) => TelemetryEntry | undefined
  clearAll: () => void
}

type TelemetryStore = TelemetryState & TelemetryActions

export const useTelemetryStore = create<TelemetryStore>((set, get) => ({
  data: {},

  setTelemetry: (deviceId, datastreamKey, value, ts) => {
    const key = `${deviceId}:${datastreamKey}`
    set((state) => ({
      data: {
        ...state.data,
        [key]: { value, ts },
      },
    }))
  },

  getTelemetry: (key) => get().data[key],

  clearAll: () => set({ data: {} }),
}))

/**
 * Selector hook — only re-renders when the specific key changes.
 */
export function useTelemetryValue(
  deviceId: string,
  datastreamKey: string
): TelemetryEntry | undefined {
  const key = `${deviceId}:${datastreamKey}`
  return useTelemetryStore((state) => state.data[key])
}
