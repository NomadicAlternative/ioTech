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
  const relayNum = Number(config.settings.relay ?? 1)

  // Derive state from telemetry when available; otherwise track locally
  const telemetryOn = entry !== undefined ? String(entry.value) === onValue : null
  const [localState, setLocalState] = useState<boolean | null>(null)

  // telemetry wins once it arrives; until then use localState; default OFF
  const displayed = telemetryOn !== null ? telemetryOn : (localState ?? false)
  const [pending, setPending] = useState(false)

  const handleToggle = async (checked: boolean) => {
    if (pending) return
    setLocalState(checked)
    setPending(true)
    const state: 'on' | 'off' = checked ? 'on' : 'off'
    try {
      await sendDeviceCommand(deviceId, relayNum, state)
    } catch {
      // revert on error
      setLocalState(!checked)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-full gap-4">
      <Switch checked={displayed} onCheckedChange={handleToggle} disabled={!deviceId || pending} />
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
