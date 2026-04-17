import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useWidgetConfigStore } from '@/stores/widgetConfigStore'
import { useDashboardStore } from '@/features/dashboard/dashboardStore'
import { fetchDevices, fetchDeviceTemplate } from '@/features/dashboard/api'
import { getWidgetDef } from './registry'
import type { Device, DeviceTemplate, WidgetConfig } from './types'

export function WidgetConfigPanel() {
  const { isOpen, editingWidgetId, closeConfig } = useWidgetConfigStore()
  const { layout, setLayout } = useDashboardStore()

  const entry = layout.find((e) => e.i === editingWidgetId)
  const def = entry ? getWidgetDef(entry.widgetType) : undefined

  // Local config state (edited but not yet saved)
  const [localConfig, setLocalConfig] = useState<WidgetConfig | null>(null)

  // Device + datastream data
  const [devices, setDevices] = useState<Device[]>([])
  const [template, setTemplate] = useState<DeviceTemplate | null>(null)
  const [loadingDevices, setLoadingDevices] = useState(false)
  const [loadingTemplate, setLoadingTemplate] = useState(false)

  // Initialize local config when panel opens
  useEffect(() => {
    if (isOpen && entry) {
      setLocalConfig({ ...entry.config, settings: { ...entry.config.settings } })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingWidgetId])

  // Load devices when panel opens
  useEffect(() => {
    if (!isOpen) return
    setLoadingDevices(true)
    fetchDevices()
      .then(setDevices)
      .catch(() => {/* silently ignore */})
      .finally(() => setLoadingDevices(false))
  }, [isOpen])

  // Load template when device changes
  useEffect(() => {
    if (!localConfig?.deviceId) {
      setTemplate(null)
      return
    }
    const device = devices.find((d) => d.id === localConfig.deviceId)
    if (!device?.templateId) {
      setTemplate(null)
      return
    }
    setLoadingTemplate(true)
    fetchDeviceTemplate(device.templateId)
      .then(setTemplate)
      .catch(() => setTemplate(null))
      .finally(() => setLoadingTemplate(false))
  }, [localConfig?.deviceId, devices])

  const handleSave = () => {
    if (!editingWidgetId || !localConfig) return
    const newLayout = layout.map((e) =>
      e.i === editingWidgetId ? { ...e, config: localConfig } : e
    )
    setLayout(newLayout)
    closeConfig()
  }

  const handleDelete = () => {
    if (!editingWidgetId) return
    const newLayout = layout.filter((e) => e.i !== editingWidgetId)
    setLayout(newLayout)
    closeConfig()
  }

  const updateConfig = (partial: Partial<WidgetConfig>) => {
    setLocalConfig((prev) => prev ? { ...prev, ...partial } : prev)
  }

  if (!localConfig || !entry) return null

  const datastreams = template?.datastreams ?? []

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeConfig()}>
      <SheetContent className="w-[360px] sm:w-[400px] overflow-y-auto flex flex-col">
        <SheetHeader>
          <SheetTitle>{def?.label ?? entry.widgetType} Settings</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-4 py-4">
          {/* Widget name */}
          <div className="space-y-1">
            <Label>Widget name</Label>
            <Input
              value={localConfig.name}
              onChange={(e) => updateConfig({ name: e.target.value })}
              placeholder="e.g. Temperature sensor"
            />
          </div>

          <Separator />

          {/* Device selector */}
          <div className="space-y-1">
            <Label>Device</Label>
            <Select
              value={localConfig.deviceId ?? ''}
              onValueChange={(v) => updateConfig({ deviceId: v || null, datastreamKey: null })}
              disabled={loadingDevices}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingDevices ? 'Loading…' : 'Select a device'} />
              </SelectTrigger>
              <SelectContent>
                {devices.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Datastream selector */}
          {localConfig.deviceId && (
            <div className="space-y-1">
              <Label>Datastream</Label>
              <Select
                value={localConfig.datastreamKey ?? ''}
                onValueChange={(v) => updateConfig({ datastreamKey: v || null })}
                disabled={loadingTemplate || !template}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingTemplate ? 'Loading…' : 'Select a datastream'} />
                </SelectTrigger>
                <SelectContent>
                  {datastreams.map((ds) => (
                    <SelectItem key={ds.key} value={ds.key}>
                      {ds.name} <span className="text-muted-foreground text-xs">({ds.key})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Separator />

          {/* Type-specific settings */}
          {def && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Widget settings</p>
              <def.configFields
                settings={localConfig.settings}
                onChange={(settings) => updateConfig({ settings })}
              />
            </div>
          )}
        </div>

        <SheetFooter className="flex-col gap-2 sm:flex-col">
          <Button className="w-full" onClick={handleSave}>Save changes</Button>
          <Button variant="destructive" className="w-full" onClick={handleDelete}>
            Delete widget
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
