/**
 * TypeScript types for the Automation Rules API.
 *
 * These types mirror the backend schemas and are used by the frontend
 * forms, API layer, and store.
 */

// ── Action types ──────────────────────────────────────────────────────────────

export type ActionType =
  | 'relay'
  | 'command'
  | 'charging_start'
  | 'charging_stop'
  | 'low_power_mode';

// ── Trigger types ─────────────────────────────────────────────────────────────

export type TriggerType =
  | 'threshold'
  | 'status'
  | 'battery_low';

// ── Action configs ────────────────────────────────────────────────────────────

export interface RelayActionConfig {
  relay: number;
  state: boolean;
}

export interface CommandActionConfig {
  command: string;
  params?: Record<string, unknown>;
}

export interface ChargingActionConfig {
  deviceId: string;
}

export interface LowPowerActionConfig extends ChargingActionConfig {
  duration_minutes?: number;
}

export type ActionConfig =
  | RelayActionConfig
  | CommandActionConfig
  | ChargingActionConfig
  | LowPowerActionConfig;

// ── Trigger configs ───────────────────────────────────────────────────────────

export interface ThresholdTriggerConfig {
  field: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: number;
}

export interface StatusTriggerConfig {
  field: string;
  value: string;
}

export interface BatteryLowTriggerConfig {
  threshold: number;
  field?: string;
}

export type TriggerConfig =
  | ThresholdTriggerConfig
  | StatusTriggerConfig
  | BatteryLowTriggerConfig;

// ── Rule ──────────────────────────────────────────────────────────────────────

export interface Rule {
  id?: string;
  name: string;
  description?: string;
  trigger_type: TriggerType;
  trigger_config: TriggerConfig;
  action_type: ActionType;
  action_config: ActionConfig;
  cooldown?: number;
  enabled?: boolean;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
}

// ── API response types ────────────────────────────────────────────────────────

export interface RuleListResponse {
  rules: Rule[];
  total: number;
}

// ── Option helpers (for form selects) ─────────────────────────────────────────

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

export const ACTION_TYPE_OPTIONS: SelectOption<ActionType>[] = [
  { value: 'relay', label: 'Relay Control' },
  { value: 'command', label: 'Send Command' },
  { value: 'charging_start', label: 'Start Charging' },
  { value: 'charging_stop', label: 'Stop Charging' },
  { value: 'low_power_mode', label: 'Low Power Mode' },
];

export const TRIGGER_TYPE_OPTIONS: SelectOption<TriggerType>[] = [
  { value: 'threshold', label: 'Threshold' },
  { value: 'status', label: 'Status Match' },
  { value: 'battery_low', label: 'Battery Low' },
];
