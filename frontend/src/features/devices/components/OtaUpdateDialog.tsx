import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useFirmwareStore } from '@/features/firmware/firmwareStore'
import { triggerOta } from '@/features/firmware/firmwareApi'
import type { FirmwareVersion } from '@/features/firmware/types'

interface Props {
  deviceId: string
  hardwareModel: string | null
  open: boolean
  onClose: () => void
}

export function OtaUpdateDialog({ deviceId, hardwareModel, open, onClose }: Props) {
  const { t } = useTranslation()
  const firmwareList = useFirmwareStore((s) => s.firmwareList)
  const fetchFirmwareList = useFirmwareStore((s) => s.fetchFirmwareList)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filter firmware versions by hardware_model client-side
  const available = useMemo(() => {
    if (!hardwareModel) return []
    return firmwareList.filter((fw) => fw.hardware_model === hardwareModel)
  }, [firmwareList, hardwareModel])

  const selectedFw = useMemo(
    () => available.find((fw) => fw.id === selectedId) ?? null,
    [available, selectedId]
  )

  async function handleConfirm() {
    if (!selectedFw) return
    setSending(true)
    setError(null)
    try {
      await triggerOta(deviceId, selectedFw.version)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('devices.ota.unknownError'))
    } finally {
      setSending(false)
    }
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      onClose()
      // Reset state for next open
      setTimeout(() => {
        setSelectedId(null)
        setSending(false)
        setSuccess(false)
        setError(null)
      }, 300)
    } else {
      // Refresh firmware list on open
      fetchFirmwareList()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            {t('devices.ota.title')}
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm font-medium text-green-800">
              {t('devices.ota.triggered')}
            </div>
            <Button className="w-full" onClick={onClose}>
              {t('common.close')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {!hardwareModel ? (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                {t('devices.ota.noHardwareModel')}
              </div>
            ) : available.length === 0 ? (
              <div className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                {t('devices.ota.noVersions')}
              </div>
            ) : (
              <>
                {error && (
                  <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
                    {error}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-sm font-medium">{t('devices.ota.selectVersion')}</label>
                  <Select value={selectedId ?? ''} onValueChange={(v) => setSelectedId(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('devices.ota.selectPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {available.map((fw) => (
                        <SelectItem key={fw.id} value={fw.id}>
                          {fw.version}{fw.release_notes ? ` — ${fw.release_notes}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedFw?.release_notes && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {t('devices.ota.releaseNotes')}
                    </p>
                    <p className="text-sm text-muted-foreground bg-muted rounded-md px-3 py-2">
                      {selectedFw.release_notes}
                    </p>
                  </div>
                )}
              </>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              {hardwareModel && available.length > 0 && (
                <Button onClick={handleConfirm} disabled={!selectedId || sending}>
                  {sending ? t('common.sending') : t('devices.ota.confirm')}
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
