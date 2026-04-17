import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { sendDeviceCommand } from '@/features/dashboard/api'
import type { WidgetProps, ConfigFieldsProps } from '../types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function ButtonWidget({ widgetId: _widgetId, config }: WidgetProps) {
  const deviceId = config.deviceId ?? ''
  const [loading, setLoading] = useState(false)

  const action = String(config.settings.action ?? 'trigger')
  const label = String(config.settings.label ?? 'Send')
  const variant = (config.settings.variant as 'default' | 'destructive' | 'outline') ?? 'default'

  const handleClick = async () => {
    if (!deviceId) return
    setLoading(true)
    try {
      await sendDeviceCommand(deviceId, action, config.settings.payload)
    } catch {
      // silently ignore for MVP
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-full">
      <Button variant={variant} onClick={handleClick} disabled={loading || !deviceId}>
        {loading ? 'Sending…' : label}
      </Button>
    </div>
  )
}

export function ButtonConfigFields({ settings, onChange }: ConfigFieldsProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Label</Label>
        <Input value={String(settings.label ?? 'Send')} onChange={(e) => onChange({ ...settings, label: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label>Action</Label>
        <Input value={String(settings.action ?? 'trigger')} onChange={(e) => onChange({ ...settings, action: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label>Variant</Label>
        <Select value={String(settings.variant ?? 'default')} onValueChange={(v) => onChange({ ...settings, variant: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default</SelectItem>
            <SelectItem value="destructive">Destructive</SelectItem>
            <SelectItem value="outline">Outline</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
