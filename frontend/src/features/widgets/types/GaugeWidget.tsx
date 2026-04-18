import { useTelemetryValue } from '@/stores/telemetryStore'
import type { WidgetProps, ConfigFieldsProps } from '../types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useEffect } from 'react'
// ─── Component ────────────────────────────────────────────────────────────────

export function GaugeWidget({ widgetId: _widgetId, config }: WidgetProps) {
  const entry = useTelemetryValue(config.deviceId ?? '', config.datastreamKey ?? '')
  const value = typeof entry?.value === 'number' ? entry.value : Number(entry?.value ?? 0)

  const min = Number(config.settings.min ?? 0)
  const max = Number(config.settings.max ?? 100)
  const unit = String(config.settings.unit ?? '')

  const clamped = Math.min(Math.max(value, min), max)
  const pct = max > min ? (clamped - min) / (max - min) : 0

  // SVG arc gauge: semi-circle, 180 degrees
  const r = 60
  const cx = 80
  const cy = 80
  const startAngle = -180
  const sweepAngle = 180 * pct
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const x1 = cx + r * Math.cos(toRad(startAngle))
  const y1 = cy + r * Math.sin(toRad(startAngle))
  const x2 = cx + r * Math.cos(toRad(startAngle + sweepAngle))
  const y2 = cy + r * Math.sin(toRad(startAngle + sweepAngle))
  const largeArc = sweepAngle > 90 ? 1 : 0

  const arcColor =
    pct < 0.33 ? '#22c55e' : pct < 0.66 ? '#eab308' : '#ef4444'

  return (
    <div className="flex flex-col items-center justify-center h-full gap-1">
      <svg width={160} height={90} viewBox="0 0 160 90">
        {/* Background track */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={10}
          strokeLinecap="round"
        />
        {/* Value arc */}
        {sweepAngle > 0 && (
          <path
            d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
            fill="none"
            stroke={arcColor}
            strokeWidth={10}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="text-3xl font-bold tabular-nums -mt-6">
        {value.toFixed(1)}
        {unit && <span className="text-base font-normal ml-1 text-muted-foreground">{unit}</span>}
      </div>
      <div className="flex justify-between w-full px-2 text-xs text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

// ─── Config fields ────────────────────────────────────────────────────────────

/**
 * Config fields for the Gauge widget.
 * Validates that min < max before allowing the parent form to save (SC-DASH-036).
 */
export function GaugeConfigFields({ settings, onChange, onValidChange }: ConfigFieldsProps) {
  const min = Number(settings.min ?? 0)
  const max = Number(settings.max ?? 100)
  const minMaxError = min >= max

  // Notify parent of validation state whenever min/max changes (SC-DASH-036)
  useEffect(() => {
    onValidChange?.(!minMaxError)
  }, [minMaxError, onValidChange])

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Min</Label>
        <Input
          type="number"
          value={String(settings.min ?? 0)}
          onChange={(e) => onChange({ ...settings, min: Number(e.target.value) })}
        />
      </div>
      <div className="space-y-1">
        <Label>Max</Label>
        <Input
          type="number"
          value={String(settings.max ?? 100)}
          onChange={(e) => onChange({ ...settings, max: Number(e.target.value) })}
        />
        {minMaxError && (
          <p className="text-xs text-destructive">min must be less than max</p>
        )}
      </div>
      <div className="space-y-1">
        <Label>Unit</Label>
        <Input
          value={String(settings.unit ?? '')}
          onChange={(e) => onChange({ ...settings, unit: e.target.value })}
        />
      </div>
    </div>
  )
}
