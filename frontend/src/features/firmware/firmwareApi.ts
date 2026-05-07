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
