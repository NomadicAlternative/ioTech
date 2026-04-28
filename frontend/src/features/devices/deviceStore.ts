import { create } from 'zustand'
import type { Device, PaginationMeta } from '@/features/widgets/types'
import * as deviceApi from './api'
import type { CreateDevicePayload, UpdateDevicePayload } from './api'

// ─── State & Actions ──────────────────────────────────────────────────────────

interface DeviceState {
  devices: Device[]
  currentDevice: Device | null
  pagination: PaginationMeta
  search: string
}

interface DeviceActions {
  fetchDevices: (page?: number, limit?: number, search?: string) => Promise<void>
  fetchDevice: (id: string) => Promise<void>
  createDevice: (data: CreateDevicePayload) => Promise<Device>
  updateDevice: (id: string, data: UpdateDevicePayload) => Promise<void>
  deleteDevice: (id: string) => Promise<void>
  setPage: (page: number) => void
  setSearch: (search: string) => void
  clearCurrent: () => void
  setDeviceOnlineStatus: (deviceId: string, status: 'online' | 'offline') => void
}

type DeviceStore = DeviceState & DeviceActions

const DEFAULT_PAGINATION: PaginationMeta = { page: 1, limit: 10, total: 0, totalPages: 1 }

/**
 * Zustand store for device CRUD and server-side pagination.
 *
 * @example
 * const { devices, fetchDevices, pagination } = useDeviceStore()
 */
export const useDeviceStore = create<DeviceStore>((set, get) => ({
  // ─── State ──────────────────────────────────────────────────────────────────
  devices: [],
  currentDevice: null,
  pagination: DEFAULT_PAGINATION,
  search: '',

  // ─── Actions ────────────────────────────────────────────────────────────────
  fetchDevices: async (page, limit, search) => {
    const { pagination, search: storedSearch } = get()
    const resolvedPage = page ?? pagination.page
    const resolvedLimit = limit ?? pagination.limit
    const resolvedSearch = search !== undefined ? search : storedSearch

    const result = await deviceApi.listDevices(resolvedPage, resolvedLimit, resolvedSearch || undefined)
    set({ devices: result.data, pagination: result.meta })
  },

  fetchDevice: async (id: string) => {
    const device = await deviceApi.getDevice(id)
    set({ currentDevice: device })
  },

  createDevice: async (data: CreateDevicePayload) => {
    const device = await deviceApi.createDevice(data)
    set((state) => ({ devices: [device, ...state.devices] }))
    return device
  },

  updateDevice: async (id: string, data: UpdateDevicePayload) => {
    const updated = await deviceApi.updateDevice(id, data)
    set((state) => ({
      devices: state.devices.map((d) => (d.id === id ? updated : d)),
      currentDevice: state.currentDevice?.id === id ? updated : state.currentDevice,
    }))
  },

  deleteDevice: async (id: string) => {
    await deviceApi.deleteDevice(id)
    set((state) => ({
      devices: state.devices.filter((d) => d.id !== id),
      currentDevice: state.currentDevice?.id === id ? null : state.currentDevice,
    }))
  },

  setPage: (page: number) => {
    set((state) => ({ pagination: { ...state.pagination, page } }))
  },

  setSearch: (search: string) => {
    set({ search })
  },

  clearCurrent: () => set({ currentDevice: null }),

  setDeviceOnlineStatus: (deviceId: string, status: 'online' | 'offline') => {
    const isOnline = status === 'online'
    set((state) => ({
      devices: state.devices.map((d) =>
        d.id === deviceId ? { ...d, isOnline } : d
      ),
      currentDevice:
        state.currentDevice?.id === deviceId
          ? { ...state.currentDevice, isOnline }
          : state.currentDevice,
    }))
  },
}))
