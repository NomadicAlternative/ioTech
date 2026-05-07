// ─── FirmwareVersion ─────────────────────────────────────────────────────────────
// Matches the backend model: firmware_versions table

export interface FirmwareVersion {
  id: string
  tenant_id: string
  version: string
  hardware_model: string
  release_notes: string | null
  download_url: string
  created_at: string
  updated_at: string
}

export interface CreateFirmwarePayload {
  version: string
  hardware_model: string
  release_notes?: string | null
  download_url: string
}

export type UpdateFirmwarePayload = Partial<CreateFirmwarePayload>
