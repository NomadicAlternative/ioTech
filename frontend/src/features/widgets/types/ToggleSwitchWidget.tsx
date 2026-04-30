import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useTelemetryValue } from '@/stores/telemetryStore'
import { sendDeviceCommand } from '@/features/dashboard/api'
import type { WidgetProps, ConfigFieldsProps } from '../types'
import { Input } from '@/components/ui/input'

export function ToggleSwitchWidget({ widgetId: _widgetId, config }: WidgetProps) {
  const deviceId = config.deviceId ?? ''
  const datastreamKey = config.datastreamKey ?? ''
  const entry = useTelemetryValue(deviceId, datastreamKey)
  const onValue = String(config.settings.onValue ?? '1')
  const isOn = String(entry?.value) === onValue
  const relayNum = Number(config.settings.relay ?? 1)

  const [optimistic, setOptimistic] = useState<boolean | null>(null)
  const displayed = optimistic !== null ? optimistic : isOn

  const handleToggle = async (checked: boolean) => {
    setOptimistic(checked)
    const state: 'on' | 'off' = checked ? 'on' : 'off'
    try {
      await sendDeviceCommand(deviceId, relayNum, state)
    } catch {
      // revert optimistic
      setOptimistic(!checked)
    } finally {
      setOptimistic(null)
    }
  }

  return (
    <div className="flex items-center justify-center h-full gap-4">
      <Switch checked={displayed} onCheckedChange={handleToggle} disabled={!deviceId} />
      <Label className="text-sm">{displayed ? 'ON' : 'OFF'}</Label>
    </div>
  )
}

export function ToggleSwitchConfigFields({ settings, onChange }: ConfigFieldsProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Relay number</Label>
        <Input
          type="number"
          min={1}
          max={8}
          value={String(settings.relay ?? 1)}
          onChange={(e) => onChange({ ...settings, relay: Number(e.target.value) })}
        />
      </div>
      <div className="space-y-1">
        <Label>On value (telemetry)</Label>
        <Input value={String(settings.onValue ?? '1')} onChange={(e) => onChange({ ...settings, onValue: e.target.value })} />
      </div>
    </div>
  )
}
