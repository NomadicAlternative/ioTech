import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDeviceStore } from '../deviceStore'
import { listTemplates, listClients } from '../api'
import type { DeviceTemplate, Client } from '@/features/widgets/types'

interface Props {
  deviceId: string
  onClose: () => void
  onSuccess: () => void
}

export function EditDeviceDialog({ deviceId, onClose, onSuccess }: Props) {
  const { t } = useTranslation()
  const { devices, updateDevice } = useDeviceStore()
  const device = devices.find((d) => d.id === deviceId)

  const [name, setName] = useState(device?.name ?? '')
  const [templateId, setTemplateId] = useState(device?.templateId ?? '')
  const [clientId, setClientId] = useState(device?.clientId ?? '')
  const [metadata, setMetadata] = useState(
    device?.metadata ? JSON.stringify(device.metadata, null, 2) : ''
  )
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [templates, setTemplates] = useState<DeviceTemplate[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loadingDropdowns, setLoadingDropdowns] = useState(true)

  useEffect(() => {
    Promise.all([listTemplates(), listClients()])
      .then(([tmpl, c]) => {
        setTemplates(tmpl)
        setClients(c)
      })
      .catch(() => {/* dropdowns empty but form still works */})
      .finally(() => setLoadingDropdowns(false))
  }, [])

  async function handleSave() {
    if (!name.trim()) return

    let parsedMetadata: Record<string, unknown> | null = null
    if (metadata.trim()) {
      try {
        parsedMetadata = JSON.parse(metadata) as Record<string, unknown>
      } catch {
        setMetadataError(t('common.invalidJson'))
        return
      }
    }

    setSaving(true)
    setError(null)
    try {
      await updateDevice(deviceId, {
        name: name.trim(),
        ...(templateId ? { templateId } : {}),
        ...(clientId ? { clientId } : {}),
        ...(parsedMetadata ? { metadata: parsedMetadata } : {}),
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('devices.edit.errorUpdate'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('devices.edit.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error && (
            <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-1">
            <Label>{t('common.nameLabel')}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('devices.edit.namePlaceholder')}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label>{t('devices.create.templateLabel')}</Label>
            {loadingDropdowns ? (
              <div className="h-9 bg-muted animate-pulse rounded-md" />
            ) : (
              <Select value={templateId} onValueChange={(v) => setTemplateId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder={t('devices.create.templatePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((tmpl) => (
                    <SelectItem key={tmpl.id} value={tmpl.id}>
                      {tmpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1">
            <Label>{t('devices.create.clientLabel')}</Label>
            {loadingDropdowns ? (
              <div className="h-9 bg-muted animate-pulse rounded-md" />
            ) : (
              <Select value={clientId} onValueChange={(v) => setClientId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder={t('devices.create.clientPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1">
            <Label>{t('devices.create.metadataLabel')}</Label>
            <textarea
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
              value={metadata}
              onChange={(e) => {
                setMetadata(e.target.value)
                setMetadataError(null)
              }}
              placeholder='{"key": "value"}'
            />
            {metadataError && <p className="text-destructive text-xs">{metadataError}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? t('common.saving') : t('common.saveChanges')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
