import api from '@/lib/axios'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Rule {
  id: string
  name: string
  description: string | null
  enabled: boolean
  triggerType: 'threshold' | 'status'
  triggerConfig: Record<string, unknown>
  actionType: 'relay' | 'command'
  actionConfig: Record<string, unknown>
  cooldownMs: number
  lastFiredAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateRulePayload {
  name: string
  description?: string | null
  enabled?: boolean
  triggerType: 'threshold' | 'status'
  triggerConfig: Record<string, unknown>
  actionType: 'relay' | 'command'
  actionConfig: Record<string, unknown>
  cooldownMs?: number
}

export type UpdateRulePayload = Partial<CreateRulePayload>

// ─── API functions ─────────────────────────────────────────────────────────────

export async function fetchRules(): Promise<Rule[]> {
  const res = await api.get<{ data: Rule[] }>('/api/rules')
  return res.data.data
}

export async function fetchRule(id: string): Promise<Rule> {
  const res = await api.get<{ data: Rule }>(`/api/rules/${id}`)
  return res.data.data
}

export async function createRule(data: CreateRulePayload): Promise<Rule> {
  const res = await api.post<{ data: Rule }>('/api/rules', data)
  return res.data.data
}

export async function updateRule(id: string, data: UpdateRulePayload): Promise<Rule> {
  const res = await api.put<{ data: Rule }>(`/api/rules/${id}`, data)
  return res.data.data
}

export async function deleteRule(id: string): Promise<void> {
  await api.delete(`/api/rules/${id}`)
}
