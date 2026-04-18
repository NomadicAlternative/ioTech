import { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useTelemetryStore } from '@/stores/telemetryStore'
import { fetchTelemetryHistory } from '@/features/dashboard/api'
import type { WidgetProps, ConfigFieldsProps } from '../types'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

interface DataPoint {
  timestamp: string
  value: number
}

export function LineChartWidget({ widgetId: _widgetId, config }: WidgetProps) {
  const [history, setHistory] = useState<DataPoint[]>([])
  const deviceId = config.deviceId ?? ''
  const datastreamKey = config.datastreamKey ?? ''
  const color = String(config.settings.color ?? '#3b82f6')
  const period = String(config.settings.period ?? '24h')
  const showGrid = config.settings.showGrid !== false

  // Load historical data — refetches when device, datastream, or period changes (SC-DASH-038)
  useEffect(() => {
    if (!deviceId || !datastreamKey) return
    fetchTelemetryHistory(deviceId, datastreamKey, 100)
      .then((data) => setHistory(data.map((d) => ({ ...d, value: Number(d.value) }))))
      .catch(() => {/* silently ignore */})
  }, [deviceId, datastreamKey, period])

  // Subscribe to live updates
  const liveEntry = useTelemetryStore((s) => {
    const key = `${deviceId}:${datastreamKey}`
    return s.data[key]
  })

  const chartData = useMemo(() => {
    const base = history.map((d) => ({
      t: new Date(d.timestamp).toLocaleTimeString(),
      v: d.value,
    }))
    if (liveEntry) {
      const livePoint = {
        t: new Date(liveEntry.ts).toLocaleTimeString(),
        v: Number(liveEntry.value),
      }
      return [...base, livePoint]
    }
    return base
  }, [history, liveEntry])

  if (!deviceId || !datastreamKey) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No datastream configured
      </div>
    )
  }

  return (
    <div className="h-full w-full pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />}
          <XAxis dataKey="t" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} width={40} />
          <Tooltip />
          <Line type="monotone" dataKey="v" stroke={color} dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function LineChartConfigFields({ settings, onChange }: ConfigFieldsProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Period</Label>
        <Select
          value={String(settings.period ?? '24h')}
          onValueChange={(v) => onChange({ ...settings, period: v })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">Last 1 hour</SelectItem>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Color</Label>
        <Input
          type="color"
          value={String(settings.color ?? '#3b82f6')}
          onChange={(e) => onChange({ ...settings, color: e.target.value })}
          className="h-9 px-1"
        />
      </div>
    </div>
  )
}
