import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RuleForm } from '../RuleForm'
import { useRulesStore } from '../rulesStore'
import type { Rule } from '../rulesApi'

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock react-i18next so t() returns the fallback value
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}))

import * as rulesApi from '../rulesApi'
const mockApi = vi.mocked(rulesApi)

vi.mock('../rulesApi', () => ({
  fetchRules: vi.fn(),
  fetchRule: vi.fn(),
  createRule: vi.fn(),
  updateRule: vi.fn(),
  deleteRule: vi.fn(),
}))

const NEW_RULE = { id: 'new-1', name: 'Test Rule', description: null, enabled: true, triggerType: 'threshold' as const, triggerConfig: { field: '', operator: 'gt', value: 0 }, actionType: 'relay' as const, actionConfig: { relay: 1, state: true }, cooldownMs: 0, lastFiredAt: null, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' }

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

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
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

/**
 * Select mock with per-instance callbacks using a WeakMap keyed by render order.
 */
let selectIndex = 0
const selectCallbacks: Map<number, (v: string) => void> = new Map()

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange }: {
    children: React.ReactNode; value?: string; onValueChange?: (v: string) => void
  }) => {
    const idx = selectIndex++
    if (onValueChange) selectCallbacks.set(idx, onValueChange)
    return <div data-testid="select-root" data-idx={idx}>{children}</div>
  },
  SelectTrigger: ({ children }: { children: React.ReactNode }) =>
    <button data-testid="select-trigger">{children}</button>,
  SelectContent: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <button
      data-testid="select-item"
      data-value={value}
      onClick={() => {
        // All current select callbacks are candidates — call the one for the
        // most recently rendered Select that still matches
        // We find the select root that this item belongs to by DOM proximity
        // For simplicity, we look at the parent chain to find the select root
        const allRoots = document.querySelectorAll('[data-testid="select-root"]')
        allRoots.forEach((root) => {
          const rootIdx = Number(root.getAttribute('data-idx'))
          const cb = selectCallbacks.get(rootIdx)
          const isParent = root.contains(document.activeElement) ||
            (root.parentElement && document.activeElement?.closest('[data-testid="select-root"]') === root)
          // If we can't determine, just call all callbacks (last one wins)
          if (cb) cb(value)
        })
      }}
    >
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) =>
    <span data-testid="select-value">{placeholder}</span>,
  SelectGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectLabel: () => null,
}))

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const EXISTING_RULE: Rule = {
  id: 'rule-1',
  name: 'High Temp Alert',
  description: 'Turn on fan when temp > 30',
  enabled: true,
  triggerType: 'threshold',
  triggerConfig: { field: 'temperature', operator: 'gt', value: 30 },
  actionType: 'relay',
  actionConfig: { relay: 1, state: true },
  cooldownMs: 60000,
  lastFiredAt: null,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('RuleForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectIndex = 0
    selectCallbacks.clear()
    useRulesStore.setState({
      rules: [],
      currentRule: null,
      loading: false,
      error: null,
    })
  })

  describe('Create mode', () => {
    it('renders all basic fields', () => {
      render(<RuleForm open={true} onClose={vi.fn()} />)

      expect(screen.getByText('Create Automation Rule')).toBeInTheDocument()
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Description')).toBeInTheDocument()
      expect(screen.getByText('Cooldown (ms)')).toBeInTheDocument()
      expect(screen.getByText('Enabled')).toBeInTheDocument()
    })

    it('renders trigger type and action type selects', () => {
      render(<RuleForm open={true} onClose={vi.fn()} />)

      expect(screen.getByText('Trigger')).toBeInTheDocument()
      expect(screen.getByText('Action')).toBeInTheDocument()
      expect(screen.getByText('Trigger Type')).toBeInTheDocument()
      expect(screen.getByText('Action Type')).toBeInTheDocument()
    })

    it('shows threshold fields when trigger type is threshold', async () => {
      render(<RuleForm open={true} onClose={vi.fn()} />)

      act(() => {
        const cb = selectCallbacks.get(0)
        if (cb) cb('threshold')
      })

      expect(await screen.findByText('Field')).toBeInTheDocument()
      expect(await screen.findByText('Operator')).toBeInTheDocument()
      expect(await screen.findByText('Value')).toBeInTheDocument()
    })

    it('shows relay fields when action type is relay', async () => {
      render(<RuleForm open={true} onClose={vi.fn()} />)

      act(() => {
        const cb = selectCallbacks.get(1)
        if (cb) cb('relay')
      })

      expect(await screen.findByText('Relay Number')).toBeInTheDocument()
      expect(await screen.findByText('State')).toBeInTheDocument()
    })

    it('validates required name field on submit', async () => {
      const onClose = vi.fn()
      render(<RuleForm open={true} onClose={onClose} />)

      await userEvent.click(screen.getByText('Create'))

      expect(screen.getByText('Name is required')).toBeInTheDocument()
      expect(onClose).not.toHaveBeenCalled()
    })

    it('validates relay number is between 1-8', async () => {
      render(<RuleForm open={true} onClose={vi.fn()} />)

      // Fill name
      await userEvent.type(screen.getByPlaceholderText('Rule name'), 'Test Rule')

      // Select threshold trigger + relay action
      act(() => {
        const cbTrigger = selectCallbacks.get(0)
        if (cbTrigger) cbTrigger('threshold')
        const cbAction = selectCallbacks.get(1)
        if (cbAction) cbAction('relay')
      })

      // Set relay number to 9 (invalid)
      const relayInput = screen.getByRole('spinbutton', { name: 'Relay number' })
      await userEvent.clear(relayInput)
      await userEvent.type(relayInput, '9')

      await userEvent.click(screen.getByText('Create'))

      expect(screen.getByText('Relay must be between 1 and 8')).toBeInTheDocument()
    })

    it('calls createRule with form data on valid submit', async () => {
      const onClose = vi.fn()
      mockApi.createRule.mockResolvedValue(NEW_RULE)

      render(<RuleForm open={true} onClose={onClose} />)

      // Fill name
      await userEvent.type(screen.getByPlaceholderText('Rule name'), 'Test Rule')

      // Select threshold trigger + relay action via callbacks in act()
      act(() => {
        const cbTrigger = selectCallbacks.get(0)
        if (cbTrigger) cbTrigger('threshold')
        const cbAction = selectCallbacks.get(1)
        if (cbAction) cbAction('relay')
      })

      // Submit
      act(() => {
        const submitBtn = screen.getByText('Create')
        submitBtn.click()
      })

      await waitFor(() => {
        expect(mockApi.createRule).toHaveBeenCalled()
        expect(onClose).toHaveBeenCalled()
      })
    })
  })

  describe('Edit mode', () => {
    it('pre-fills fields from existing rule', () => {
      render(<RuleForm open={true} onClose={vi.fn()} rule={EXISTING_RULE} />)

      expect(screen.getByDisplayValue('High Temp Alert')).toBeInTheDocument()
    })

    it('shows Save button in edit mode', () => {
      render(<RuleForm open={true} onClose={vi.fn()} rule={EXISTING_RULE} />)

      expect(screen.getByText('Save')).toBeInTheDocument()
      expect(screen.queryByText('Create')).not.toBeInTheDocument()
    })

    it('calls updateRule on valid submit in edit mode', async () => {
      const onClose = vi.fn()
      mockApi.updateRule.mockResolvedValue(EXISTING_RULE)

      render(<RuleForm open={true} onClose={onClose} rule={EXISTING_RULE} />)

      await userEvent.click(screen.getByText('Save'))

      await waitFor(() => {
        expect(mockApi.updateRule).toHaveBeenCalledWith('rule-1', expect.any(Object))
        expect(onClose).toHaveBeenCalled()
      })
    })
  })
})
