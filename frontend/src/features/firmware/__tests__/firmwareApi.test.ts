import { describe, it, expect, vi, beforeEach } from 'vitest'
import api from '@/lib/axios'
import { triggerOta, checkFirmware } from '../firmwareApi'

vi.mock('@/lib/axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

const mockApi = vi.mocked(api)

describe('triggerOta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('posts to /api/devices/:id/ota and returns the firmware result', async () => {
    mockApi.post.mockResolvedValue({
      data: { data: { ok: true, firmware: { version: '2.0.0', url: 'https://example.com/fw.bin' } } },
    })

    const result = await triggerOta('device-1')

    expect(mockApi.post).toHaveBeenCalledWith('/api/devices/device-1/ota', {})
    expect(result).toEqual({ ok: true, firmware: { version: '2.0.0', url: 'https://example.com/fw.bin' } })
  })

  it('passes requested version in the body when provided', async () => {
    mockApi.post.mockResolvedValue({
      data: { data: { ok: true, firmware: { version: '3.0.0', url: 'https://example.com/fw3.bin' } } },
    })

    await triggerOta('device-1', '3.0.0')

    expect(mockApi.post).toHaveBeenCalledWith('/api/devices/device-1/ota', { version: '3.0.0' })
  })
})

describe('checkFirmware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls GET /api/firmware/check with hardware_model param', async () => {
    mockApi.get.mockResolvedValue({
      data: { version: '2.0.0', url: 'https://example.com/fw.bin' },
    })

    const result = await checkFirmware('esp32dev')

    expect(mockApi.get).toHaveBeenCalledWith('/api/firmware/check', {
      params: { hardware_model: 'esp32dev' },
    })
    expect(result).toEqual({ version: '2.0.0', url: 'https://example.com/fw.bin' })
  })

  it('passes current version when provided', async () => {
    mockApi.get.mockResolvedValue({
      data: { upToDate: true },
    })

    const result = await checkFirmware('esp32dev', '2.0.0')

    expect(mockApi.get).toHaveBeenCalledWith('/api/firmware/check', {
      params: { hardware_model: 'esp32dev', current: '2.0.0' },
    })
    expect(result).toEqual({ upToDate: true })
  })
})
