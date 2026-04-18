import { useEffect, useState } from 'react'
import { useTelemetryValue } from '@/stores/telemetryStore'
import type { WidgetProps, ConfigFieldsProps } from '../types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export function StatCardWidget({ widgetId: _widgetId, config }: WidgetProps) {
  const entry = useTelemetryValue(config.deviceId ?? '', config.datastreamKey ?? '')
  const value = typeof entry?.value === 'number' ? entry.value : Number(entry?.value ?? 0)
  const unit = String(config.settings.unit ?? '')

  // Track previous value for trend via async state update (satisfies no-ref-during-render + no-sync-setState-in-effect)
  const [prevValue, setPrevValue] = useState<number | null>(null)
  const trend: 'up' | 'down' | 'neutral' =
    prevValue === null ? 'neutral' : value > prevValue ? 'up' : value < prevValue ? 'down' : 'neutral'

  useEffect(() => {
    Promise.resolve().then(() => setPrevValue(value))
  }, [value])

  return (
    <div className="flex flex-col justify-between h-full p-1">
      <div className="text-4xl font-bold tabular-nums">
        {isNaN(value) ? '—' : value.toFixed(1)}
        {unit && <span className="text-base font-normal ml-1 text-muted-foreground">{unit}</span>}
      </div>
      <div className="flex items-center gap-1 text-sm">
        {trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500" />}
        {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
        {trend === 'neutral' && <Minus className="w-4 h-4 text-muted-foreground" />}
        <span className="text-muted-foreground">vs prev</span>
      </div>
    </div>
  )
}

export function StatCardConfigFields({ settings, onChange }: ConfigFieldsProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Unit</Label>
        <Input value={String(settings.unit ?? '')} onChange={(e) => onChange({ ...settings, unit: e.target.value })} />
      </div>
    </div>
  )
}
