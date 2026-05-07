import { create } from 'zustand'
import type { FirmwareVersion, CreateFirmwarePayload, UpdateFirmwarePayload } from './types'
import * as firmwareApi from './firmwareApi'

interface FirmwareState {
  firmwareList: FirmwareVersion[]
  loading: boolean
  error: string | null
}

interface FirmwareActions {
  fetchFirmwareList: () => Promise<void>
  createFirmware: (data: CreateFirmwarePayload) => Promise<FirmwareVersion>
  updateFirmware: (id: string, data: UpdateFirmwarePayload) => Promise<void>
  deleteFirmware: (id: string) => Promise<void>
}

type FirmwareStore = FirmwareState & FirmwareActions

export const useFirmwareStore = create<FirmwareStore>((set) => ({
  firmwareList: [],
  loading: false,
  error: null,

  fetchFirmwareList: async () => {
    set({ loading: true, error: null })
    try {
      const firmwareList = await firmwareApi.fetchFirmwareList()
      set({ firmwareList, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch firmware list'
      set({ error: message, loading: false })
    }
  },

  createFirmware: async (data: CreateFirmwarePayload) => {
    const firmware = await firmwareApi.createFirmware(data)
    set((state) => ({ firmwareList: [firmware, ...state.firmwareList] }))
    return firmware
  },

  updateFirmware: async (id: string, data: UpdateFirmwarePayload) => {
    const updated = await firmwareApi.updateFirmware(id, data)
    set((state) => ({
      firmwareList: state.firmwareList.map((f) => (f.id === id ? updated : f)),
    }))
  },

  deleteFirmware: async (id: string) => {
    await firmwareApi.deleteFirmware(id)
    set((state) => ({
      firmwareList: state.firmwareList.filter((f) => f.id !== id),
    }))
  },
}))
