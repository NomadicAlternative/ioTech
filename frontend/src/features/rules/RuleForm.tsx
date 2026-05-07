import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useRulesStore } from './rulesStore'
import { useDeviceStore } from '@/features/devices/deviceStore'
import type { Rule } from './rulesApi'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface RuleFormProps {
  open: boolean
  onClose: () => void
  rule?: Rule | null
}

type TriggerType = 'threshold' | 'status' | 'battery_low'
type ActionType = 'relay' | 'command' | 'charging_start' | 'charging_stop' | 'low_power_mode'
type Operator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq'

interface FormData {
  name: string
  description: string
  enabled: boolean
  cooldownMs: string
  triggerType: TriggerType | ''
  triggerDeviceId: string
  triggerField: string
  triggerOperator: Operator | ''
  triggerValue: string
  triggerStatus: string
  batteryField: string
  batteryThreshold: string
  actionType: ActionType | ''
  actionDeviceId: string
  actionRelay: string
  actionState: boolean
  actionPowerDuration: string
}

interface FormErrors {
  name?: string
  relay?: string
  actionDeviceId?: string
}

const OPERATORS: { value: Operator; label: string }[] = [
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'eq', label: '=' },
  { value: 'neq', label: '≠' },
]

const initialState: FormData = {
  name: '',
  description: '',
  enabled: true,
  cooldownMs: '0',
  triggerType: '',
  triggerDeviceId: '',
  triggerField: '',
  triggerOperator: '',
  triggerValue: '',
  triggerStatus: 'offline',
  batteryField: 'battery_level',
  batteryThreshold: '20',
  actionType: '',
  actionDeviceId: '',
  actionRelay: '1',
  actionState: true,
  actionPowerDuration: '60',
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function RuleForm({ open, onClose, rule }: RuleFormProps) {
  const { t } = useTranslation()
  const { createRule, updateRule } = useRulesStore()
  const { devices, fetchDevices } = useDeviceStore()

  const [form, setForm] = useState<FormData>(initialState)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const isEdit = !!rule

  // Load devices for selectors
  useEffect(() => {
    if (open) {
      fetchDevices()
    }
  }, [open])

  // Populate form when editing
  useEffect(() => {
    if (rule) {
      const triggerConfig = rule.triggerConfig as Record<string, unknown>
      const actionConfig = rule.actionConfig as Record<string, unknown>
      setForm({
        name: rule.name,
        description: rule.description ?? '',
        enabled: rule.enabled,
        cooldownMs: String(rule.cooldownMs),
        triggerType: rule.triggerType,
        triggerDeviceId: String(triggerConfig.deviceId ?? ''),
        triggerField: String(triggerConfig.datastreamKey ?? triggerConfig.field ?? ''),
        triggerOperator: String(triggerConfig.operator ?? '') as Operator | '',
        triggerValue: String(triggerConfig.value ?? ''),
        triggerStatus: String(triggerConfig.status ?? 'offline'),
        batteryField: String(triggerConfig.field ?? 'battery_level'),
        batteryThreshold: String(triggerConfig.threshold ?? '20'),
        actionType: rule.actionType,
        actionDeviceId: String(actionConfig.deviceId ?? ''),
        actionRelay: String(actionConfig.relay ?? '1'),
        actionState: actionConfig.state === true,
        actionPowerDuration: String(actionConfig.durationMinutes ?? '60'),
      })
    } else {
      setForm(initialState)
    }
    setErrors({})
    setSubmitError(null)
  }, [rule, open])

  // ── Helpers ────────────────────────────────────────────────────────────────

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    // Clear error when field is modified
    if (key === 'name' && errors.name) {
      setErrors((prev) => ({ ...prev, name: undefined }))
    }
    if (key === 'actionRelay' && errors.relay) {
      setErrors((prev) => ({ ...prev, relay: undefined }))
    }
  }

  function validate(): boolean {
    const newErrors: FormErrors = {}
    if (!form.name.trim()) {
      newErrors.name = t('rules.form.errors.nameRequired', 'Name is required')
    }
    const relayNum = parseInt(form.actionRelay, 10)
    if (form.actionType === 'relay' && (isNaN(relayNum) || relayNum < 1 || relayNum > 8)) {
      newErrors.relay = t('rules.form.errors.relayRange', 'Relay must be between 1 and 8')
    }
    if (
      ['charging_start', 'charging_stop', 'low_power_mode'].includes(form.actionType) &&
      !form.actionDeviceId
    ) {
      newErrors.actionDeviceId = t('rules.form.errors.deviceRequired', 'Device is required for this action')
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        enabled: form.enabled,
        cooldownMs: parseInt(form.cooldownMs, 10) || 0,
        triggerType: form.triggerType,
        triggerConfig: buildTriggerConfig(),
        actionType: form.actionType,
        actionConfig: buildActionConfig(),
      }

      if (isEdit && rule) {
        await updateRule(rule.id, payload)
      } else {
        await createRule(payload as Parameters<typeof createRule>[0])
      }
      onClose()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save rule')
    } finally {
      setSubmitting(false)
    }
  }

  function buildTriggerConfig(): Record<string, unknown> {
    if (form.triggerType === 'threshold') {
      return {
        deviceId: form.triggerDeviceId || undefined,
        datastreamKey: form.triggerField,
        operator: form.triggerOperator,
        value: parseFloat(form.triggerValue),
      }
    }
    if (form.triggerType === 'status') {
      return {
        deviceId: form.triggerDeviceId || undefined,
        status: form.triggerStatus,
      }
    }
    if (form.triggerType === 'battery_low') {
      return {
        deviceId: form.triggerDeviceId || undefined,
        field: form.batteryField || 'battery_level',
        threshold: parseFloat(form.batteryThreshold),
      }
    }
    return {}
  }

  function buildActionConfig(): Record<string, unknown> {
    if (form.actionType === 'relay') {
      return {
        deviceId: form.actionDeviceId || undefined,
        relay: parseInt(form.actionRelay, 10),
        state: form.actionState,
      }
    }
    if (['charging_start', 'charging_stop'].includes(form.actionType)) {
      return {
        deviceId: form.actionDeviceId,
      }
    }
    if (form.actionType === 'low_power_mode') {
      return {
        deviceId: form.actionDeviceId,
        durationMinutes: parseInt(form.actionPowerDuration, 10) || undefined,
      }
    }
    return {}
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t('rules.form.editTitle', 'Edit Automation Rule')
              : t('rules.form.createTitle', 'Create Automation Rule')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2 max-h-[60vh] overflow-y-auto">
          {/* Submit error */}
          {submitError && (
            <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
              {submitError}
            </div>
          )}

          {/* ── Basic fields ────────────────────────────────────────────────── */}
          <div className="space-y-1">
            <Label>{t('common.nameLabel', 'Name')}</Label>
            <Input
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder={t('rules.form.namePlaceholder', 'Rule name')}
              autoFocus
            />
            {errors.name && (
              <p className="text-destructive text-xs mt-1">{errors.name}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>{t('common.descLabel', 'Description')}</Label>
            <Input
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder={t('rules.form.descPlaceholder', 'Optional description')}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>{t('common.enabled', 'Enabled')}</Label>
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => updateField('enabled', v)}
              size="sm"
            />
          </div>

          <div className="space-y-1">
            <Label>{t('rules.form.cooldownMs', 'Cooldown (ms)')}</Label>
            <Input
              type="number"
              min={0}
              value={form.cooldownMs}
              onChange={(e) => updateField('cooldownMs', e.target.value)}
              placeholder="0"
            />
          </div>

          {/* ── Trigger section ─────────────────────────────────────────────── */}
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold">{t('rules.form.triggerSection', 'Trigger')}</h3>

            <div className="space-y-1">
              <Label>{t('rules.form.triggerType', 'Trigger Type')}</Label>
              <Select
                value={form.triggerType}
                onValueChange={(v: TriggerType) => updateField('triggerType', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('rules.form.selectTriggerType', 'Select trigger type')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="threshold">{t('rules.form.threshold', 'Threshold')}</SelectItem>
                  <SelectItem value="status">{t('rules.form.status', 'Status')}</SelectItem>
                  <SelectItem value="battery_low">{t('rules.form.batteryLow', 'Battery Low')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.triggerType === 'threshold' && (
              <>
                <div className="space-y-1">
                  <Label>{t('rules.form.triggerDevice', 'Trigger Device')}</Label>
                  <Select
                    value={form.triggerDeviceId}
                    onValueChange={(v: string) => updateField('triggerDeviceId', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('rules.form.selectDevice', 'Select device')} />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name || d.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{t('rules.form.datastreamKey', 'Datastream Key')}</Label>
                  <Input
                    value={form.triggerField}
                    onChange={(e) => updateField('triggerField', e.target.value)}
                    placeholder="temperature"
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t('rules.form.operator', 'Operator')}</Label>
                  <Select
                    value={form.triggerOperator}
                    onValueChange={(v: Operator) => updateField('triggerOperator', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('rules.form.selectOperator', 'Select operator')} />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{t('rules.form.value', 'Value')}</Label>
                  <Input
                    type="number"
                    value={form.triggerValue}
                    onChange={(e) => updateField('triggerValue', e.target.value)}
                    placeholder="30"
                  />
                </div>
              </>
            )}

            {form.triggerType === 'status' && (
              <>
                <div className="space-y-1">
                  <Label>{t('rules.form.triggerDevice', 'Trigger Device')}</Label>
                  <Select
                    value={form.triggerDeviceId}
                    onValueChange={(v: string) => updateField('triggerDeviceId', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('rules.form.selectDevice', 'Select device')} />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name || d.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{t('rules.form.statusValue', 'Status')}</Label>
                  <Select
                    value={form.triggerStatus}
                    onValueChange={(v: string) => updateField('triggerStatus', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('rules.form.selectStatus', 'Select status')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="offline">{t('rules.form.offline', 'Offline')}</SelectItem>
                      <SelectItem value="online">{t('rules.form.online', 'Online')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {form.triggerType === 'battery_low' && (
              <>
                <div className="space-y-1">
                  <Label>{t('rules.form.triggerDevice', 'Trigger Device')}</Label>
                  <Select
                    value={form.triggerDeviceId}
                    onValueChange={(v: string) => updateField('triggerDeviceId', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('rules.form.selectDevice', 'Select device')} />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name || d.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{t('rules.form.batteryField', 'Battery Field')}</Label>
                  <Input
                    value={form.batteryField}
                    onChange={(e) => updateField('batteryField', e.target.value)}
                    placeholder="battery_level"
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t('rules.form.batteryThreshold', 'Threshold (%)')}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={form.batteryThreshold}
                    onChange={(e) => updateField('batteryThreshold', e.target.value)}
                    placeholder="20"
                  />
                </div>
              </>
            )}
          </div>

          {/* ── Action section ──────────────────────────────────────────────── */}
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold">{t('rules.form.actionSection', 'Action')}</h3>

            <div className="space-y-1">
              <Label>{t('rules.form.actionType', 'Action Type')}</Label>
              <Select
                value={form.actionType}
                onValueChange={(v: ActionType) => updateField('actionType', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('rules.form.selectActionType', 'Select action type')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relay">{t('rules.form.relay', 'Relay')}</SelectItem>
                  <SelectItem value="charging_start">{t('rules.form.chargingStart', 'Start Charging')}</SelectItem>
                  <SelectItem value="charging_stop">{t('rules.form.chargingStop', 'Stop Charging')}</SelectItem>
                  <SelectItem value="low_power_mode">{t('rules.form.lowPower', 'Low Power Mode')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.actionType === 'relay' && (
              <>
                <div className="space-y-1">
                  <Label>{t('rules.form.actionDevice', 'Target Device')}</Label>
                  <Select
                    value={form.actionDeviceId}
                    onValueChange={(v: string) => updateField('actionDeviceId', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('rules.form.selectDevice', 'Select device')} />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name || d.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{t('rules.form.relayNumber', 'Relay Number')}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={8}
                    value={form.actionRelay}
                    onChange={(e) => updateField('actionRelay', e.target.value)}
                    placeholder="1"
                    aria-label="Relay number"
                  />
                  {errors.relay && (
                    <p className="text-destructive text-xs mt-1">{errors.relay}</p>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <Label>{t('rules.form.relayState', 'State')}</Label>
                  <Switch
                    checked={form.actionState}
                    onCheckedChange={(v) => updateField('actionState', v)}
                    size="sm"
                  />
                </div>
              </>
            )}

            {['charging_start', 'charging_stop', 'low_power_mode'].includes(form.actionType) && (
              <>
                <div className="space-y-1">
                  <Label>{t('rules.form.actionDevice', 'Target Device')}</Label>
                  <Select
                    value={form.actionDeviceId}
                    onValueChange={(v: string) => updateField('actionDeviceId', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('rules.form.selectDevice', 'Select device')} />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name || d.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.actionDeviceId && (
                    <p className="text-destructive text-xs mt-1">{errors.actionDeviceId}</p>
                  )}
                </div>
              </>
            )}

            {form.actionType === 'low_power_mode' && (
              <div className="space-y-1">
                <Label>{t('rules.form.durationMinutes', 'Duration (minutes)')}</Label>
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  value={form.actionPowerDuration}
                  onChange={(e) => updateField('actionPowerDuration', e.target.value)}
                  placeholder="60"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting
              ? t('common.saving', 'Saving...')
              : isEdit
                ? t('common.save', 'Save')
                : t('common.create', 'Create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
