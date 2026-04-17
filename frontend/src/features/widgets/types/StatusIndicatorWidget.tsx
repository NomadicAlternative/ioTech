import { useTelemetryValue } from '@/stores/telemetryStore'
import type { WidgetProps, ConfigFieldsProps } from '../types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function StatusIndicatorWidget({ widgetId: _widgetId, config }: WidgetProps) {
  const entry = useTelemetryValue(config.deviceId ?? '', config.datastreamKey ?? '')
  const value = entry?.value

  const onValue = config.settings.onValue ?? '1'
  const isOn = String(value) === String(onValue)
  const onColor = String(config.settings.onColor ?? '#22c55e')
  const offColor = String(config.settings.offColor ?? '#ef4444')
  const onLabel = String(config.settings.onLabel ?? 'ON')
  const offLabel = String(config.settings.offLabel ?? 'OFF')

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <div
        className="w-16 h-16 rounded-full transition-colors duration-300"
        style={{ backgroundColor: isOn ? onColor : offColor, boxShadow: `0 0 20px ${isOn ? onColor : offColor}66` }}
      />
      <span className="text-sm font-medium">{isOn ? onLabel : offLabel}</span>
    </div>
  )
}

export function StatusIndicatorConfigFields({ settings, onChange }: ConfigFieldsProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>On value</Label>
        <Input value={String(settings.onValue ?? '1')} onChange={(e) => onChange({ ...settings, onValue: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label>On color</Label>
        <Input type="color" value={String(settings.onColor ?? '#22c55e')} onChange={(e) => onChange({ ...settings, onColor: e.target.value })} className="h-9 px-1" />
      </div>
      <div className="space-y-1">
        <Label>Off color</Label>
        <Input type="color" value={String(settings.offColor ?? '#ef4444')} onChange={(e) => onChange({ ...settings, offColor: e.target.value })} className="h-9 px-1" />
      </div>
      <div className="space-y-1">
        <Label>On label</Label>
        <Input value={String(settings.onLabel ?? 'ON')} onChange={(e) => onChange({ ...settings, onLabel: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label>Off label</Label>
        <Input value={String(settings.offLabel ?? 'OFF')} onChange={(e) => onChange({ ...settings, offLabel: e.target.value })} />
      </div>
    </div>
  )
}
