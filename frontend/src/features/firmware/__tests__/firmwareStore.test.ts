import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useFirmwareStore } from '../firmwareStore'
import * as firmwareApi from '../firmwareApi'
import type { FirmwareVersion } from '../types'

vi.mock('../firmwareApi', () => ({
  fetchFirmwareList: vi.fn(),
  createFirmware: vi.fn(),
  updateFirmware: vi.fn(),
  deleteFirmware: vi.fn(),
}))

const mockApi = vi.mocked(firmwareApi)

const FW_A: FirmwareVersion = {
  id: 'fw-1',
  tenant_id: 'tenant-1',
  version: '2.1.0',
  hardware_model: 'ESP32-DevKitC',
  release_notes: 'Initial release',
  download_url: 'https://example.com/fw-2.1.0.bin',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

const FW_B: FirmwareVersion = {
  id: 'fw-2',
  tenant_id: 'tenant-1',
  version: '2.0.0',
  hardware_model: 'ESP32-S3',
  release_notes: null,
  download_url: 'https://example.com/fw-2.0.0.bin',
  created_at: '2025-01-02T00:00:00Z',
  updated_at: '2025-01-02T00:00:00Z',
}

function resetStore() {
  useFirmwareStore.setState({
    firmwareList: [],
    loading: false,
    error: null,
  })
}

describe('firmwareStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()
  })

  describe('fetchFirmwareList', () => {
    it('sets firmwareList and clears error on success', async () => {
      mockApi.fetchFirmwareList.mockResolvedValue([FW_A, FW_B])
      await useFirmwareStore.getState().fetchFirmwareList()
      const state = useFirmwareStore.getState()
      expect(state.firmwareList).toEqual([FW_A, FW_B])
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('sets error state on failure', async () => {
      mockApi.fetchFirmwareList.mockRejectedValue(new Error('Network error'))
      await useFirmwareStore.getState().fetchFirmwareList()
      const state = useFirmwareStore.getState()
      expect(state.firmwareList).toEqual([])
      expect(state.error).toBe('Network error')
      expect(state.loading).toBe(false)
    })

    it('sets loading to true during fetch', async () => {
      mockApi.fetchFirmwareList.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([FW_A]), 50))
      )
      const promise = useFirmwareStore.getState().fetchFirmwareList()
      expect(useFirmwareStore.getState().loading).toBe(true)
      await promise
      expect(useFirmwareStore.getState().loading).toBe(false)
    })
  })

  describe('createFirmware', () => {
    it('adds new firmware to list and returns it', async () => {
      const newFw = { ...FW_A, id: 'fw-new' }
      mockApi.createFirmware.mockResolvedValue(newFw)
      useFirmwareStore.setState({ firmwareList: [FW_B] })
      const result = await useFirmwareStore.getState().createFirmware({
        version: '3.0.0',
        hardware_model: 'ESP32-DevKitC',
        download_url: 'https://example.com/fw-3.0.0.bin',
      })
      expect(result).toEqual(newFw)
      expect(useFirmwareStore.getState().firmwareList).toEqual([newFw, FW_B])
    })
  })

  describe('updateFirmware', () => {
    it('updates firmware in list', async () => {
      const updated = { ...FW_A, version: '2.1.1' }
      mockApi.updateFirmware.mockResolvedValue(updated)
      useFirmwareStore.setState({ firmwareList: [FW_A, FW_B] })
      await useFirmwareStore.getState().updateFirmware('fw-1', { version: '2.1.1' })
      const state = useFirmwareStore.getState()
      expect(state.firmwareList.find((f) => f.id === 'fw-1')?.version).toBe('2.1.1')
      expect(state.firmwareList.find((f) => f.id === 'fw-2')).toEqual(FW_B)
    })
  })

  describe('deleteFirmware', () => {
    it('removes firmware from list', async () => {
      mockApi.deleteFirmware.mockResolvedValue(undefined)
      useFirmwareStore.setState({ firmwareList: [FW_A, FW_B] })
      await useFirmwareStore.getState().deleteFirmware('fw-1')
      expect(useFirmwareStore.getState().firmwareList).toEqual([FW_B])
    })
  })
})
