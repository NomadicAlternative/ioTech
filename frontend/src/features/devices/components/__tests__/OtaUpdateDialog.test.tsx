import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OtaUpdateDialog } from '../OtaUpdateDialog'
import { useFirmwareStore } from '@/features/firmware/firmwareStore'
import * as firmwareApi from '@/features/firmware/firmwareApi'
import type { FirmwareVersion } from '@/features/firmware/types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'devices.ota.title': 'Update Firmware',
        'devices.ota.selectVersion': 'Select Version',
        'devices.ota.selectPlaceholder': 'Choose a version...',
        'devices.ota.releaseNotes': 'Release Notes',
        'devices.ota.confirm': 'Update Firmware',
        'devices.ota.triggered': 'OTA triggered successfully',
        'devices.ota.noVersions': 'No firmware versions available',
        'devices.ota.noHardwareModel': 'Cannot resolve firmware target',
        'devices.ota.unknownError': 'Unknown error',
        'common.cancel': 'Cancel',
        'common.close': 'Close',
        'common.sending': 'Sending...',
      }
      return map[key] ?? key
    },
  }),
}))

vi.mock('@/features/firmware/firmwareApi', () => ({
  triggerOta: vi.fn(),
}))

vi.mock('@/lib/axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }: {
    children: React.ReactNode; onClick?: () => void; disabled?: boolean
  }) => <button onClick={onClick} disabled={disabled}>{children}</button>,
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: {
    value?: string; onValueChange?: (v: string) => void; children: React.ReactNode
  }) => (
    <div data-testid="select-wrapper">
      <select
        data-testid="firmware-select"
        value={value ?? ''}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="" disabled>Choose a version...</option>
        {children}
      </select>
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}))

const FW_A: FirmwareVersion = {
  id: 'fw-1',
  tenant_id: 'tenant-1',
  version: '2.1.0',
  hardware_model: 'ESP32-DevKitC',
  release_notes: 'Bug fixes and performance improvements',
  download_url: 'https://example.com/fw-2.1.0.bin',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

const FW_B: FirmwareVersion = {
  id: 'fw-2',
  tenant_id: 'tenant-1',
  version: '2.0.0',
  hardware_model: 'ESP32-DevKitC',
  release_notes: null,
  download_url: 'https://example.com/fw-2.0.0.bin',
  created_at: '2025-01-02T00:00:00Z',
  updated_at: '2025-01-02T00:00:00Z',
}

const FW_C: FirmwareVersion = {
  id: 'fw-3',
  tenant_id: 'tenant-1',
  version: '1.0.0',
  hardware_model: 'ESP32-S3',
  release_notes: 'Initial release',
  download_url: 'https://example.com/fw-1.0.0.bin',
  created_at: '2025-01-03T00:00:00Z',
  updated_at: '2025-01-03T00:00:00Z',
}

const mockTriggerOta = vi.mocked(firmwareApi.triggerOta)

function resetStore() {
  useFirmwareStore.setState({
    firmwareList: [],
    loading: false,
    error: null,
  })
}

describe('OtaUpdateDialog', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()
  })

  it('renders firmware versions filtered by hardware_model', async () => {
    useFirmwareStore.setState({ firmwareList: [FW_A, FW_B, FW_C] })

    render(
      <OtaUpdateDialog
        deviceId="device-1"
        hardwareModel="ESP32-DevKitC"
        open
        onClose={onClose}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('2.1.0 — Bug fixes and performance improvements')).toBeInTheDocument()
      expect(screen.getByText('2.0.0')).toBeInTheDocument()
      // ESP32-S3 firmware should NOT be shown
      expect(screen.queryByText('1.0.0 — Initial release')).not.toBeInTheDocument()
    })
  })

  it('shows empty state when no firmware versions match hardware_model', async () => {
    useFirmwareStore.setState({ firmwareList: [FW_C] })

    render(
      <OtaUpdateDialog
        deviceId="device-1"
        hardwareModel="ESP32-DevKitC"
        open
        onClose={onClose}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('No firmware versions available')).toBeInTheDocument()
    })
  })

  it('calls triggerOta on confirm and shows success message', async () => {
    mockTriggerOta.mockResolvedValue({
      ok: true,
      firmware: { version: '2.1.0', url: 'https://example.com/fw-2.1.0.bin' },
    })
    useFirmwareStore.setState({ firmwareList: [FW_A, FW_B] })

    render(
      <OtaUpdateDialog
        deviceId="device-1"
        hardwareModel="ESP32-DevKitC"
        open
        onClose={onClose}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('2.1.0 — Bug fixes and performance improvements')).toBeInTheDocument()
    })

    // Select a firmware version first
    await userEvent.selectOptions(screen.getByTestId('firmware-select'), 'fw-1')

    await userEvent.click(screen.getByRole('button', { name: 'Update Firmware' }))

    await waitFor(() => {
      expect(mockTriggerOta).toHaveBeenCalledWith('device-1', '2.1.0')
      expect(screen.getByText('OTA triggered successfully')).toBeInTheDocument()
    })
  })

  it('shows error message when triggerOta fails', async () => {
    mockTriggerOta.mockRejectedValue(new Error('MQTT broker unavailable'))
    useFirmwareStore.setState({ firmwareList: [FW_A] })

    render(
      <OtaUpdateDialog
        deviceId="device-1"
        hardwareModel="ESP32-DevKitC"
        open
        onClose={onClose}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('2.1.0 — Bug fixes and performance improvements')).toBeInTheDocument()
    })

    // Select a firmware version first
    await userEvent.selectOptions(screen.getByTestId('firmware-select'), 'fw-1')

    await userEvent.click(screen.getByRole('button', { name: 'Update Firmware' }))

    await waitFor(() => {
      expect(screen.getByText('MQTT broker unavailable')).toBeInTheDocument()
    })
  })

  it('calls onClose when cancel is clicked', async () => {
    useFirmwareStore.setState({ firmwareList: [FW_A] })

    render(
      <OtaUpdateDialog
        deviceId="device-1"
        hardwareModel="ESP32-DevKitC"
        open
        onClose={onClose}
      />
    )

    await userEvent.click(screen.getByText('Cancel'))

    expect(onClose).toHaveBeenCalledOnce()
  })
})
