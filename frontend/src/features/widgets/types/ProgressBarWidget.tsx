import { useTelemetryValue } from '@/stores/telemetryStore'
import type { WidgetProps, ConfigFieldsProps } from '../types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ProgressBarWidget({ widgetId: _widgetId, config }: WidgetProps) {
  const entry = useTelemetryValue(config.deviceId ?? '', config.datastreamKey ?? '')
  const value = typeof entry?.value === 'number' ? entry.value : Number(entry?.value ?? 0)

  const min = Number(config.settings.min ?? 0)
  const max = Number(config.settings.max ?? 100)
  const unit = String(config.settings.unit ?? '')
  const color = String(config.settings.color ?? '#3b82f6')

  const pct = max > min ? Math.min(Math.max((value - min) / (max - min), 0), 1) * 100 : 0

  return (
    <div className="flex flex-col justify-center h-full gap-2 px-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium tabular-nums">{isNaN(value) ? '—' : value.toFixed(1)} {unit}</span>
        <span className="text-muted-foreground">{pct.toFixed(0)}%</span>
      </div>
      <div className="w-full h-4 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

export function ProgressBarConfigFields({ settings, onChange }: ConfigFieldsProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Min</Label>
        <Input type="number" value={String(settings.min ?? 0)} onChange={(e) => onChange({ ...settings, min: Number(e.target.value) })} />
      </div>
      <div className="space-y-1">
        <Label>Max</Label>
        <Input type="number" value={String(settings.max ?? 100)} onChange={(e) => onChange({ ...settings, max: Number(e.target.value) })} />
      </div>
      <div className="space-y-1">
        <Label>Unit</Label>
        <Input value={String(settings.unit ?? '')} onChange={(e) => onChange({ ...settings, unit: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label>Color</Label>
        <Input type="color" value={String(settings.color ?? '#3b82f6')} onChange={(e) => onChange({ ...settings, color: e.target.value })} className="h-9 px-1" />
      </div>
    </div>
  )
}
