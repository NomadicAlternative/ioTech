import api from '@/lib/axios'
import type { FirmwareVersion, CreateFirmwarePayload, UpdateFirmwarePayload } from './types'

export async function fetchFirmwareList(): Promise<FirmwareVersion[]> {
  const res = await api.get<{ data: FirmwareVersion[] }>('/api/firmware')
  return res.data.data
}

export async function createFirmware(data: CreateFirmwarePayload): Promise<FirmwareVersion> {
  const res = await api.post<{ data: FirmwareVersion }>('/api/firmware', data)
  return res.data.data
}

export async function updateFirmware(id: string, data: UpdateFirmwarePayload): Promise<FirmwareVersion> {
  const res = await api.patch<{ data: FirmwareVersion }>(`/api/firmware/${id}`, data)
  return res.data.data
}

export async function deleteFirmware(id: string): Promise<void> {
  await api.delete(`/api/firmware/${id}`)
}

export interface OtaResult {
  ok: boolean
  firmware: { version: string; url: string }
}

export async function triggerOta(deviceId: string, version?: string): Promise<OtaResult> {
  const body: Record<string, string> = {}
  if (version) body.version = version
  const res = await api.post<{ data: OtaResult }>(`/api/devices/${deviceId}/ota`, body)
  return res.data.data
}

export async function checkFirmware(hardwareModel: string, current?: string): Promise<{ version?: string; url?: string; upToDate?: boolean }> {
  const params: Record<string, string> = { hardware_model: hardwareModel }
  if (current) params.current = current
  const res = await api.get<{ version?: string; url?: string; upToDate?: boolean }>('/api/firmware/check', { params })
  return res.data
}
