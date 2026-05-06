import { create } from 'zustand'
import type { Rule, CreateRulePayload, UpdateRulePayload } from './rulesApi'
import * as rulesApi from './rulesApi'

// ─── State & Actions ──────────────────────────────────────────────────────────

interface RulesState {
  rules: Rule[]
  currentRule: Rule | null
  loading: boolean
  error: string | null
}

interface RulesActions {
  fetchRules: () => Promise<void>
  fetchRule: (id: string) => Promise<void>
  createRule: (data: CreateRulePayload) => Promise<Rule>
  updateRule: (id: string, data: UpdateRulePayload) => Promise<void>
  deleteRule: (id: string) => Promise<void>
  clearCurrentRule: () => void
}

type RulesStore = RulesState & RulesActions

/**
 * Zustand store for automation rules CRUD.
 *
 * @example
 * const { rules, fetchRules, loading } = useRulesStore()
 */
export const useRulesStore = create<RulesStore>((set, get) => ({
  // ─── State ──────────────────────────────────────────────────────────────────
  rules: [],
  currentRule: null,
  loading: false,
  error: null,

  // ─── Actions ────────────────────────────────────────────────────────────────
  fetchRules: async () => {
    set({ loading: true, error: null })
    try {
      const rules = await rulesApi.fetchRules()
      set({ rules, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch rules'
      set({ error: message, loading: false })
    }
  },

  fetchRule: async (id: string) => {
    set({ loading: true, error: null })
    try {
      const rule = await rulesApi.fetchRule(id)
      set({ currentRule: rule, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch rule'
      set({ error: message, loading: false })
    }
  },

  createRule: async (data: CreateRulePayload) => {
    const rule = await rulesApi.createRule(data)
    set((state) => ({ rules: [rule, ...state.rules] }))
    return rule
  },

  updateRule: async (id: string, data: UpdateRulePayload) => {
    const updated = await rulesApi.updateRule(id, data)
    set((state) => ({
      rules: state.rules.map((r) => (r.id === id ? updated : r)),
      currentRule: state.currentRule?.id === id ? updated : state.currentRule,
    }))
  },

  deleteRule: async (id: string) => {
    await rulesApi.deleteRule(id)
    set((state) => ({
      rules: state.rules.filter((r) => r.id !== id),
      currentRule: state.currentRule?.id === id ? null : state.currentRule,
    }))
  },

  clearCurrentRule: () => set({ currentRule: null }),
}))
