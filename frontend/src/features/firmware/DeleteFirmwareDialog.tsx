import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useFirmwareStore } from './firmwareStore'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface DeleteFirmwareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  firmwareId: string | null
  onDeleted: () => void
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function DeleteFirmwareDialog({
  open,
  onOpenChange,
  firmwareId,
  onDeleted,
}: DeleteFirmwareDialogProps) {
  const { t } = useTranslation()
  const { deleteFirmware } = useFirmwareStore()
  const [deleting, setDeleting] = useState(false)

  async function handleConfirm() {
    if (!firmwareId) return
    setDeleting(true)
    try {
      await deleteFirmware(firmwareId)
      onOpenChange(false)
      onDeleted()
    } catch {
      // error handled by store
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('firmware.delete.title', 'Delete Firmware Version')}
          </DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <p className="text-sm text-muted-foreground">
            {t('firmware.delete.confirm', 'Are you sure you want to delete this firmware version?')}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={deleting}>
            {deleting
              ? t('common.deleting', 'Deleting...')
              : t('common.delete', 'Delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
