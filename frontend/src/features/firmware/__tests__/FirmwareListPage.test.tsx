import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { FirmwareListPage } from '../FirmwareListPage'
import { useFirmwareStore } from '../firmwareStore'
import type { FirmwareVersion } from '../types'

vi.mock('../firmwareApi', () => ({
  fetchFirmwareList: vi.fn(),
  createFirmware: vi.fn(),
  updateFirmware: vi.fn(),
  deleteFirmware: vi.fn(),
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

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

let lastFormProps: Record<string, unknown> = {}
vi.mock('../FirmwareForm', () => ({
  FirmwareForm: (props: Record<string, unknown>) => {
    lastFormProps = props
    return props.open
      ? (<div role="dialog" data-testid="firmware-form"><h2>{props.firmware ? 'Edit Firmware Version' : 'Add Firmware Version'}</h2></div>)
      : null
  },
}))

vi.mock('../DeleteFirmwareDialog', () => ({
  DeleteFirmwareDialog: ({ open, onOpenChange }: {
    open: boolean; onOpenChange: (o: boolean) => void; firmwareId: string | null
  }) =>
    open ? (<div role="dialog" data-testid="delete-firmware-dialog"><h2>Delete Firmware Version</h2><button onClick={() => onOpenChange(false)}>Cancel</button><button onClick={() => { onOpenChange(false) }}>Delete</button></div>) : null,
}))

import * as firmwareApi from '../firmwareApi'
const mockApi = vi.mocked(firmwareApi)

const FIRMWARE: FirmwareVersion[] = [
  { id: 'fw-1', tenant_id: 'tenant-1', version: '2.1.0', hardware_model: 'ESP32-DevKitC', release_notes: 'Initial release', download_url: 'https://example.com/fw-2.1.0.bin', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
  { id: 'fw-2', tenant_id: 'tenant-1', version: '2.0.0', hardware_model: 'ESP32-S3', release_notes: null, download_url: 'https://example.com/fw-2.0.0.bin', created_at: '2025-01-02T00:00:00Z', updated_at: '2025-01-02T00:00:00Z' },
]

function renderPage() {
  return render(<MemoryRouter><FirmwareListPage /></MemoryRouter>)
}

describe('FirmwareListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lastFormProps = {}
    mockApi.fetchFirmwareList.mockResolvedValue([])
    useFirmwareStore.setState({ firmwareList: [], loading: false, error: null })
  })

  it('shows loading state initially then renders firmware', async () => {
    mockApi.fetchFirmwareList.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(FIRMWARE), 100)))
    renderPage()
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(5)
    await waitFor(() => {
      expect(screen.getByText('2.1.0')).toBeInTheDocument()
      expect(screen.getByText('2.0.0')).toBeInTheDocument()
    })
  })

  it('shows firmware details in the table', async () => {
    mockApi.fetchFirmwareList.mockResolvedValue(FIRMWARE)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('2.1.0')).toBeInTheDocument()
      expect(screen.getByText('ESP32-DevKitC')).toBeInTheDocument()
      expect(screen.getByText('ESP32-S3')).toBeInTheDocument()
      expect(screen.getByText('Initial release')).toBeInTheDocument()
    })
  })

  it('shows dash for null release notes', async () => {
    mockApi.fetchFirmwareList.mockResolvedValue(FIRMWARE)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('\u2014')).toBeInTheDocument()
    })
  })

  it('has an Add Firmware button', async () => {
    mockApi.fetchFirmwareList.mockResolvedValue([])
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Add Firmware')).toBeInTheDocument()
    })
  })

  it('opens create dialog when clicking Add Firmware', async () => {
    mockApi.fetchFirmwareList.mockResolvedValue([])
    renderPage()
    await userEvent.click(screen.getByText('Add Firmware'))
    expect(screen.getByTestId('firmware-form')).toBeInTheDocument()
    expect(screen.getByText('Add Firmware Version')).toBeInTheDocument()
  })

  it('opens edit dialog when clicking edit button on a firmware row', async () => {
    mockApi.fetchFirmwareList.mockResolvedValue(FIRMWARE)
    renderPage()
    await waitFor(() => { expect(screen.getByText('2.1.0')).toBeInTheDocument() })
    const actionCells = document.querySelectorAll('td:last-child')
    const firstActionCell = actionCells[0]
    if (firstActionCell) {
      const btns = firstActionCell.querySelectorAll('button')
      if (btns[0]) await userEvent.click(btns[0])
    }
    await waitFor(() => {
      expect(lastFormProps.open).toBe(true)
      expect(lastFormProps.firmware?.id).toBe('fw-1')
    })
  })

  it('shows delete dialog when clicking delete button', async () => {
    mockApi.fetchFirmwareList.mockResolvedValue(FIRMWARE)
    renderPage()
    await waitFor(() => { expect(screen.getByText('2.1.0')).toBeInTheDocument() })
    const actionCells = document.querySelectorAll('td:last-child')
    const firstActionCell = actionCells[0]
    if (firstActionCell) {
      const btns = firstActionCell.querySelectorAll('button')
      if (btns[1]) await userEvent.click(btns[1])
    }
    await waitFor(() => {
      expect(screen.getByTestId('delete-firmware-dialog')).toBeInTheDocument()
    })
  })

  it('passes null firmware for create mode', async () => {
    mockApi.fetchFirmwareList.mockResolvedValue([])
    renderPage()
    await userEvent.click(screen.getByText('Add Firmware'))
    expect(lastFormProps.firmware).toBeNull()
  })

  it('shows error state', async () => {
    mockApi.fetchFirmwareList.mockRejectedValue(new Error('Failed to load'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Failed to load')).toBeInTheDocument()
    })
  })

  it('shows empty state when no firmware', async () => {
    mockApi.fetchFirmwareList.mockResolvedValue([])
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('No firmware versions yet')).toBeInTheDocument()
    })
  })
})
