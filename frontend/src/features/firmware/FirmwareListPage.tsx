import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, FileWarning, Edit, Trash2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useFirmwareStore } from './firmwareStore'
import { FirmwareForm } from './FirmwareForm'
import { DeleteFirmwareDialog } from './DeleteFirmwareDialog'
import type { FirmwareVersion } from './types'

function formatDate(value: string | null): string {
  if (!value) return '\u2014'
  return new Date(value).toLocaleDateString()
}

export function FirmwareListPage() {
  const { t } = useTranslation()
  const { firmwareList, loading, error, fetchFirmwareList } = useFirmwareStore()

  const [createOpen, setCreateOpen] = useState(false)
  const [editFirmware, setEditFirmware] = useState<FirmwareVersion | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    fetchFirmwareList()
  }, [fetchFirmwareList])

  function handleNew() {
    setEditFirmware(null)
    setCreateOpen(true)
  }

  function handleEdit(fw: FirmwareVersion) {
    setEditFirmware(fw)
    setCreateOpen(true)
  }

  function handleCloseForm() {
    setCreateOpen(false)
    setEditFirmware(null)
    fetchFirmwareList()
  }

  function handleDeleted() {
    fetchFirmwareList()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border)]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t('firmware.list.title', 'Firmware Versions')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('firmware.list.subtitle', 'Manage firmware versions for device provisioning')}
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          {t('firmware.list.newButton', 'Add Firmware')}
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--border)]">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                {t('firmware.list.colVersion', 'Version')}
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider hidden sm:table-cell">
                {t('firmware.list.colHardwareModel', 'Hardware Model')}
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider hidden md:table-cell">
                {t('firmware.list.colReleaseNotes', 'Release Notes')}
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider hidden lg:table-cell">
                {t('firmware.list.colCreated', 'Created')}
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading &&
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-t animate-pulse" data-testid="skeleton-row">
                  <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-24" /></td>
                  <td className="px-4 py-3 hidden sm:table-cell"><div className="h-4 bg-muted rounded w-32" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 bg-muted rounded w-48" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 bg-muted rounded w-20" /></td>
                  <td className="px-4 py-3" />
                </tr>
              ))}

            {!loading && firmwareList.length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <FileWarning className="h-12 w-12 opacity-30" />
                    <p className="font-medium">
                      {t('firmware.list.empty', 'No firmware versions yet')}
                    </p>
                    <p className="text-xs">
                      {t('firmware.list.emptySubtitle', 'Add your first firmware version')}
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {!loading &&
              firmwareList.map((fw) => (
                <tr key={fw.id} className="border-t hover:bg-[var(--blue)]/3 transition-colors group">
                  <td className="px-4 py-3 font-medium">
                    <span className="flex items-center gap-1.5">
                      {fw.version}
                      <a href={fw.download_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" title={fw.download_url}>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    <Badge variant="secondary">{fw.hardware_model}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-[200px] truncate">
                    {fw.release_notes ?? '\u2014'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {formatDate(fw.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(fw)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(fw.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <FirmwareForm
        open={createOpen || !!editFirmware}
        onClose={handleCloseForm}
        firmware={editFirmware}
      />

      <DeleteFirmwareDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null) }}
        firmwareId={deleteId}
        onDeleted={handleDeleted}
      />
    </div>
  )
}
