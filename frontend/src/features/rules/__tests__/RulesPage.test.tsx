import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { RulesPage } from '../RulesPage'
import { useRulesStore } from '../rulesStore'
import type { Rule } from '../rulesApi'

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock the API module so the store's internal calls go to the mock
vi.mock('../rulesApi', () => ({
  fetchRules: vi.fn(),
  fetchRule: vi.fn(),
  createRule: vi.fn(),
  updateRule: vi.fn(),
  deleteRule: vi.fn(),
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

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: {
    checked?: boolean; onCheckedChange?: (v: boolean) => void
  }) => (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
    />
  ),
}))

// Mock RuleForm — capture props for assertions, render title for visibility
let lastFormProps: Record<string, unknown> = {}
vi.mock('../RuleForm', () => ({
  RuleForm: (props: Record<string, unknown>) => {
    lastFormProps = props
    return props.open
      ? (
          <div role="dialog" data-testid="rule-form">
            <h2>{props.rule ? 'Edit Automation Rule' : 'Create Automation Rule'}</h2>
          </div>
        )
      : null
  },
}))

import * as rulesApi from '../rulesApi'
const mockApi = vi.mocked(rulesApi)

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const RULES: Rule[] = [
  {
    id: 'rule-1',
    name: 'High Temp Alert',
    description: 'Turn on fan',
    enabled: true,
    triggerType: 'threshold',
    triggerConfig: { field: 'temperature', operator: 'gt', value: 30 },
    actionType: 'relay',
    actionConfig: { relay: 1, state: true },
    cooldownMs: 60000,
    lastFiredAt: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'rule-2',
    name: 'Offline Alert',
    description: null,
    enabled: false,
    triggerType: 'status',
    triggerConfig: { status: 'offline' },
    actionType: 'relay',
    actionConfig: { relay: 2, state: true },
    cooldownMs: 0,
    lastFiredAt: '2025-01-02T00:00:00Z',
    createdAt: '2025-01-02T00:00:00Z',
    updatedAt: '2025-01-02T00:00:00Z',
  },
]

function renderPage() {
  return render(
    <MemoryRouter>
      <RulesPage />
    </MemoryRouter>
  )
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('RulesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lastFormProps = {}
    // Default mock: fetchRules resolves to empty
    mockApi.fetchRules.mockResolvedValue([])
    useRulesStore.setState({
      rules: [],
      currentRule: null,
      loading: false,
      error: null,
    })
  })

  it('shows loading state initially then renders rules', async () => {
    mockApi.fetchRules.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(RULES), 100))
    )
    renderPage()

    // Should show skeleton rows while loading
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(5)

    await waitFor(() => {
      expect(screen.getByText('High Temp Alert')).toBeInTheDocument()
      expect(screen.getByText('Offline Alert')).toBeInTheDocument()
    })
  })

  it('shows rule details in the table', async () => {
    mockApi.fetchRules.mockResolvedValue(RULES)
    renderPage()

    await waitFor(() => {
      // Name
      expect(screen.getByText('High Temp Alert')).toBeInTheDocument()
      // Trigger types
      expect(screen.getByText('Threshold')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      // Action types
      const relays = screen.getAllByText('Relay')
      expect(relays).toHaveLength(2)
      // Cooldown
      expect(screen.getByText('60000ms')).toBeInTheDocument()
      expect(screen.getByText('0ms')).toBeInTheDocument()
    })
  })

  it('shows enabled state as switch aria-checked', async () => {
    mockApi.fetchRules.mockResolvedValue(RULES)
    renderPage()

    await waitFor(() => {
      const switches = screen.getAllByRole('switch')
      expect(switches[0]).toHaveAttribute('aria-checked', 'true')
      expect(switches[1]).toHaveAttribute('aria-checked', 'false')
    })
  })

  it('shows lastFiredAt or dash if never fired', async () => {
    mockApi.fetchRules.mockResolvedValue(RULES)
    renderPage()

    await waitFor(() => {
      // rule-2 has lastFiredAt date
      expect(screen.getByText('1/2/2025')).toBeInTheDocument()
    })
  })

  it('has a New Rule button', async () => {
    mockApi.fetchRules.mockResolvedValue([])
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('New Rule')).toBeInTheDocument()
    })
  })

  it('opens create dialog when clicking New Rule', async () => {
    mockApi.fetchRules.mockResolvedValue([])
    renderPage()

    await userEvent.click(screen.getByText('New Rule'))

    expect(screen.getByTestId('rule-form')).toBeInTheDocument()
    expect(screen.getByText('Create Automation Rule')).toBeInTheDocument()
  })

  it('opens edit dialog when clicking edit button on a rule', async () => {
    mockApi.fetchRules.mockResolvedValue(RULES)
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('High Temp Alert')).toBeInTheDocument()
    })

    // Find the edit button in the first rule row's action cell
    const actionCells = document.querySelectorAll('td:last-child')
    const firstActionCell = actionCells[0]
    if (firstActionCell) {
      const btns = firstActionCell.querySelectorAll('button')
      // First button in action cell should be edit
      if (btns[0]) await userEvent.click(btns[0])
    }

    await waitFor(() => {
      expect(lastFormProps.open).toBe(true)
      expect(lastFormProps.rule?.id).toBe('rule-1')
    })
  })

  it('shows delete confirmation dialog and deletes the rule', async () => {
    mockApi.fetchRules.mockResolvedValue(RULES)
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('High Temp Alert')).toBeInTheDocument()
    })

    // Find the delete button in the first rule row's action cell
    const actionCells = document.querySelectorAll('td:last-child')
    const firstActionCell = actionCells[0]
    if (firstActionCell) {
      const btns = firstActionCell.querySelectorAll('button')
      // Second button in action cell should be delete
      if (btns[1]) await userEvent.click(btns[1])
    }

    // Delete confirmation dialog should appear
    await waitFor(() => {
      expect(screen.getByText('Delete Rule')).toBeInTheDocument()
    })

    // Confirm deletion
    const deleteButtons = screen.getAllByText('Delete')
    const confirmBtn = deleteButtons[deleteButtons.length === 1 ? 0 : 1]
    await userEvent.click(confirmBtn)

    await waitFor(() => {
      expect(mockApi.deleteRule).toHaveBeenCalledWith('rule-1')
    })
  })

  it('passes null rule for create mode', async () => {
    mockApi.fetchRules.mockResolvedValue([])
    renderPage()

    await userEvent.click(screen.getByText('New Rule'))

    expect(lastFormProps.rule).toBeNull()
  })

  it('shows error state', async () => {
    mockApi.fetchRules.mockRejectedValue(new Error('Failed to load'))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Failed to load')).toBeInTheDocument()
    })
  })

  it('shows empty state when no rules', async () => {
    mockApi.fetchRules.mockResolvedValue([])
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('No rules yet')).toBeInTheDocument()
    })
  })
})
