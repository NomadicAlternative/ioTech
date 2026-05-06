import { describe, it, expect, vi, beforeEach } from 'vitest'
import api from '@/lib/axios'
import {
  fetchRules,
  fetchRule,
  createRule,
  updateRule,
  deleteRule,
} from '../rulesApi'
import type { CreateRulePayload, UpdateRulePayload } from '../rulesApi'

// ─── Mock axios ────────────────────────────────────────────────────────────────

vi.mock('@/lib/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockApi = vi.mocked(api)

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_RULE = {
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

describe('rulesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchRules', () => {
    it('calls GET /api/rules and returns the rule list', async () => {
      mockApi.get.mockResolvedValue({ data: { data: [MOCK_RULE] } })

      const result = await fetchRules()

      expect(mockApi.get).toHaveBeenCalledWith('/api/rules')
      expect(result).toEqual([MOCK_RULE])
    })

    it('returns empty array when no rules exist', async () => {
      mockApi.get.mockResolvedValue({ data: { data: [] } })

      const result = await fetchRules()

      expect(result).toEqual([])
    })
  })

  describe('fetchRule', () => {
    it('calls GET /api/rules/:id and returns the rule', async () => {
      mockApi.get.mockResolvedValue({ data: { data: MOCK_RULE } })

      const result = await fetchRule('rule-1')

      expect(mockApi.get).toHaveBeenCalledWith('/api/rules/rule-1')
      expect(result).toEqual(MOCK_RULE)
    })
  })

  describe('createRule', () => {
    it('calls POST /api/rules with payload and returns created rule', async () => {
      const payload: CreateRulePayload = {
        name: 'New Rule',
        triggerType: 'threshold',
        triggerConfig: { field: 'temp', operator: 'gt', value: 25 },
        actionType: 'relay',
        actionConfig: { relay: 2, state: false },
      }
      const created = { ...MOCK_RULE, ...payload, id: 'rule-2' }
      mockApi.post.mockResolvedValue({ data: { data: created } })

      const result = await createRule(payload)

      expect(mockApi.post).toHaveBeenCalledWith('/api/rules', payload)
      expect(result).toEqual(created)
    })
  })

  describe('updateRule', () => {
    it('calls PUT /api/rules/:id with payload and returns updated rule', async () => {
      const payload: UpdateRulePayload = { name: 'Updated Name' }
      const updated = { ...MOCK_RULE, name: 'Updated Name' }
      mockApi.put.mockResolvedValue({ data: { data: updated } })

      const result = await updateRule('rule-1', payload)

      expect(mockApi.put).toHaveBeenCalledWith('/api/rules/rule-1', payload)
      expect(result).toEqual(updated)
    })
  })

  describe('deleteRule', () => {
    it('calls DELETE /api/rules/:id', async () => {
      mockApi.delete.mockResolvedValue({})

      await deleteRule('rule-1')

      expect(mockApi.delete).toHaveBeenCalledWith('/api/rules/rule-1')
    })
  })
})
