import { useTelemetryValue } from '@/stores/telemetryStore'
import type { WidgetProps, ConfigFieldsProps } from '../types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function NumberDisplayWidget({ widgetId: _widgetId, config }: WidgetProps) {
  const entry = useTelemetryValue(config.deviceId ?? '', config.datastreamKey ?? '')
  console.debug('[NumberDisplay] render', config.deviceId, config.datastreamKey, entry?.value)
  const raw = typeof entry?.value === 'number' ? entry.value : Number(entry?.value ?? 0)

  const decimals = Number(config.settings.decimals ?? 2)
  const unit = String(config.settings.unit ?? '')
  const prefix = String(config.settings.prefix ?? '')
  const suffix = String(config.settings.suffix ?? '')

  return (
    <div className="flex flex-col items-center justify-center h-full gap-1">
      <div className="text-4xl font-bold tabular-nums">
        {prefix}
        {isNaN(raw) ? '—' : raw.toFixed(decimals)}
        {suffix}
      </div>
      {unit && (
        <div className="text-sm text-muted-foreground">{unit}</div>
      )}
    </div>
  )
}

export function NumberDisplayConfigFields({ settings, onChange }: ConfigFieldsProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Unit</Label>
        <Input value={String(settings.unit ?? '')} onChange={(e) => onChange({ ...settings, unit: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label>Decimals</Label>
        <Input type="number" value={String(settings.decimals ?? 2)} onChange={(e) => onChange({ ...settings, decimals: Number(e.target.value) })} />
      </div>
      <div className="space-y-1">
        <Label>Prefix</Label>
        <Input value={String(settings.prefix ?? '')} onChange={(e) => onChange({ ...settings, prefix: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label>Suffix</Label>
        <Input value={String(settings.suffix ?? '')} onChange={(e) => onChange({ ...settings, suffix: e.target.value })} />
      </div>
    </div>
  )
}
