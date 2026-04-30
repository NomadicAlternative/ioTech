import { useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
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
  // Widget-type config validation state (e.g. gauge min < max)
  const [configValid, setConfigValid] = useState(true)

  // Device + datastream data
  const [devices, setDevices] = useState<Device[]>([])
  const [template, setTemplate] = useState<DeviceTemplate | null>(null)
  const [loadingDevices, setLoadingDevices] = useState(false)
  const [loadingTemplate, setLoadingTemplate] = useState(false)

  // Initialize local config when panel opens
  useEffect(() => {
    if (isOpen && entry) {
      Promise.resolve().then(() => {
        setLocalConfig({ ...entry.config, settings: { ...entry.config.settings } })
        setConfigValid(true) // reset validation on open
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingWidgetId])

  // Load devices when panel opens
  useEffect(() => {
    if (!isOpen) return
    Promise.resolve()
      .then(() => setLoadingDevices(true))
      .then(() => fetchDevices())
      .then(setDevices)
      .catch(() => {/* silently ignore */})
      .finally(() => setLoadingDevices(false))
  }, [isOpen])

  // Load template when device changes
  useEffect(() => {
    if (!localConfig?.deviceId) {
      Promise.resolve().then(() => setTemplate(null))
      return
    }
    const device = devices.find((d) => d.id === localConfig.deviceId)
    if (!device?.templateId) {
      Promise.resolve().then(() => setTemplate(null))
      return
    }
    Promise.resolve()
      .then(() => setLoadingTemplate(true))
      .then(() => fetchDeviceTemplate(device.templateId))
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

  const handleDuplicate = () => {
    if (!editingWidgetId || !entry || !localConfig) return
    const maxRelay = layout.reduce((max, e) => {
      const r = Number(e.config.settings?.relay ?? 0)
      return r > max ? r : max
    }, 0)
    const duplicate = {
      ...entry,
      i: uuidv4(),
      x: entry.x,
      y: entry.y + entry.h,
      config: {
        ...localConfig,
        settings: { ...localConfig.settings, relay: maxRelay + 1 },
      },
    }
    setLayout([...layout, duplicate])
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
              {!loadingTemplate && localConfig.deviceId && devices.find((d) => d.id === localConfig.deviceId) && !devices.find((d) => d.id === localConfig.deviceId)?.templateId ? (
                <p className="text-xs text-muted-foreground">
                  This device has no template assigned. Assign a template to select a datastream.
                </p>
              ) : !loadingTemplate && template && datastreams.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  This device's template has no datastreams configured.
                </p>
              ) : (
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
              )}
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
                onValidChange={setConfigValid}
              />
            </div>
          )}
        </div>

        <SheetFooter className="flex-col gap-2 sm:flex-col">
          <Button className="w-full" onClick={handleSave} disabled={!configValid}>Save changes</Button>
          <Button variant="outline" className="w-full" onClick={handleDuplicate}>Duplicate widget</Button>
          <Button variant="destructive" className="w-full" onClick={handleDelete}>
            Delete widget
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
