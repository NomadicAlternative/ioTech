import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRulesStore } from '../rulesStore'
import * as rulesApi from '../rulesApi'
import type { Rule } from '../rulesApi'

// ─── Mock API ──────────────────────────────────────────────────────────────────

vi.mock('../rulesApi', () => ({
  fetchRules: vi.fn(),
  fetchRule: vi.fn(),
  createRule: vi.fn(),
  updateRule: vi.fn(),
  deleteRule: vi.fn(),
}))

const mockApi = vi.mocked(rulesApi)

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const RULE_A: Rule = {
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

const RULE_B: Rule = {
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
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function resetStore() {
  useRulesStore.setState({
    rules: [],
    currentRule: null,
    loading: false,
    error: null,
  })
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('rulesStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()
  })

  describe('fetchRules', () => {
    it('sets rules and clears error on success', async () => {
      mockApi.fetchRules.mockResolvedValue([RULE_A, RULE_B])

      await useRulesStore.getState().fetchRules()

      const state = useRulesStore.getState()
      expect(state.rules).toEqual([RULE_A, RULE_B])
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('sets error state on failure', async () => {
      mockApi.fetchRules.mockRejectedValue(new Error('Network error'))

      await useRulesStore.getState().fetchRules()

      const state = useRulesStore.getState()
      expect(state.rules).toEqual([])
      expect(state.error).toBe('Network error')
      expect(state.loading).toBe(false)
    })

    it('sets loading to true during fetch', async () => {
      mockApi.fetchRules.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([RULE_A]), 50))
      )

      const promise = useRulesStore.getState().fetchRules()
      expect(useRulesStore.getState().loading).toBe(true)
      await promise
      expect(useRulesStore.getState().loading).toBe(false)
    })
  })

  describe('fetchRule', () => {
    it('sets currentRule on success', async () => {
      mockApi.fetchRule.mockResolvedValue(RULE_A)

      await useRulesStore.getState().fetchRule('rule-1')

      expect(useRulesStore.getState().currentRule).toEqual(RULE_A)
      expect(useRulesStore.getState().loading).toBe(false)
    })

    it('sets error on failure', async () => {
      mockApi.fetchRule.mockRejectedValue(new Error('Not found'))

      await useRulesStore.getState().fetchRule('bad-id')

      expect(useRulesStore.getState().currentRule).toBeNull()
      expect(useRulesStore.getState().error).toBe('Not found')
    })
  })

  describe('createRule', () => {
    it('adds new rule to list and returns it', async () => {
      const newRule = { ...RULE_A, id: 'rule-new' }
      mockApi.createRule.mockResolvedValue(newRule)
      // Pre-populate with existing rules
      useRulesStore.setState({ rules: [RULE_B] })

      const result = await useRulesStore.getState().createRule({
        name: 'New Rule',
        triggerType: 'threshold',
        triggerConfig: {},
        actionType: 'relay',
        actionConfig: {},
      })

      expect(result).toEqual(newRule)
      expect(useRulesStore.getState().rules).toEqual([newRule, RULE_B])
    })
  })

  describe('updateRule', () => {
    it('updates rule in list and currentRule if matching', async () => {
      const updated = { ...RULE_A, name: 'Updated Name' }
      mockApi.updateRule.mockResolvedValue(updated)
      useRulesStore.setState({ rules: [RULE_A, RULE_B], currentRule: RULE_A })

      await useRulesStore.getState().updateRule('rule-1', { name: 'Updated Name' })

      const state = useRulesStore.getState()
      expect(state.rules.find((r) => r.id === 'rule-1')?.name).toBe('Updated Name')
      expect(state.currentRule?.name).toBe('Updated Name')
    })

    it('does not update currentRule if it was not the edited one', async () => {
      const updated = { ...RULE_A, name: 'Updated' }
      mockApi.updateRule.mockResolvedValue(updated)
      useRulesStore.setState({ rules: [RULE_A, RULE_B], currentRule: RULE_B })

      await useRulesStore.getState().updateRule('rule-1', { name: 'Updated' })

      expect(useRulesStore.getState().currentRule?.id).toBe('rule-2')
    })
  })

  describe('deleteRule', () => {
    it('removes rule from list and clears currentRule if matching', async () => {
      mockApi.deleteRule.mockResolvedValue(undefined)
      useRulesStore.setState({ rules: [RULE_A, RULE_B], currentRule: RULE_A })

      await useRulesStore.getState().deleteRule('rule-1')

      const state = useRulesStore.getState()
      expect(state.rules).toEqual([RULE_B])
      expect(state.currentRule).toBeNull()
    })

    it('keeps currentRule if a different rule was deleted', async () => {
      mockApi.deleteRule.mockResolvedValue(undefined)
      useRulesStore.setState({ rules: [RULE_A, RULE_B], currentRule: RULE_A })

      await useRulesStore.getState().deleteRule('rule-2')

      expect(useRulesStore.getState().rules).toEqual([RULE_A])
      expect(useRulesStore.getState().currentRule).toEqual(RULE_A)
    })
  })

  describe('clearCurrentRule', () => {
    it('resets currentRule to null', () => {
      useRulesStore.setState({ currentRule: RULE_A })

      useRulesStore.getState().clearCurrentRule()

      expect(useRulesStore.getState().currentRule).toBeNull()
    })
  })
})
