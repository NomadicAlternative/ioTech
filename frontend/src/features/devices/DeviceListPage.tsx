import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Server, Edit, Trash2, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDeviceStore } from './deviceStore'
import { listTemplates, listClients } from './api'
import type { DeviceTemplate, Client } from '@/features/widgets/types'
import { EditDeviceDialog } from './components/EditDeviceDialog'

// ─── Status badge helper ──────────────────────────────────────────────────────

function StatusBadge({ isOnline, status }: { isOnline: boolean; status: string }) {
  const { t } = useTranslation()
  if (isOnline) {
    return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{t('devices.status.online')}</Badge>
  }
  if (status === 'offline') {
    return <Badge variant="secondary">{t('devices.status.offline')}</Badge>
  }
  return <Badge variant="outline">{status || t('devices.status.unknown')}</Badge>
}

// ─── Last seen helper ─────────────────────────────────────────────────────────

function formatLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return '—'
  return new Date(lastSeen).toLocaleString()
}

// ─── Page component ───────────────────────────────────────────────────────────

export function DeviceListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { devices, pagination, search, fetchDevices, createDevice, deleteDevice, setSearch } =
    useDeviceStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Create dialog state ──
  const [createOpen, setCreateOpen] = useState(false)
  const [templates, setTemplates] = useState<DeviceTemplate[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loadingDropdowns, setLoadingDropdowns] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTemplateId, setNewTemplateId] = useState('')
  const [newClientId, setNewClientId] = useState('')
  const [newMetadata, setNewMetadata] = useState('')
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // ── Edit dialog state ──
  const [editDeviceId, setEditDeviceId] = useState<string | null>(null)

  // ── Delete dialog state ──
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // ── Search debounce ──
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initial fetch
  useEffect(() => {
    setLoading(true)
    fetchDevices(1, 10, '')
      .catch((err) => setError(err instanceof Error ? err.message : t('devices.list.errorLoad')))
      .finally(() => setLoading(false))
  }, [fetchDevices])

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSearchChange(value: string) {
    setSearch(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setLoading(true)
      fetchDevices(1, pagination.limit, value)
        .catch((err) => setError(err instanceof Error ? err.message : t('devices.list.errorSearch')))
        .finally(() => setLoading(false))
    }, 300)
  }

  function handlePageChange(newPage: number) {
    setLoading(true)
    fetchDevices(newPage, pagination.limit, search)
      .catch((err) => setError(err instanceof Error ? err.message : t('devices.list.errorPaginate')))
      .finally(() => setLoading(false))
  }

  async function handleOpenCreate() {
    setCreateOpen(true)
    setLoadingDropdowns(true)
    try {
      const [t2, c] = await Promise.all([listTemplates(), listClients()])
      setTemplates(t2)
      setClients(c)
    } catch {
      // dropdowns will be empty
    } finally {
      setLoadingDropdowns(false)
    }
  }

  function validateMetadata(): Record<string, unknown> | null {
    if (!newMetadata.trim()) return null
    try {
      return JSON.parse(newMetadata) as Record<string, unknown>
    } catch {
      setMetadataError(t('common.invalidJson'))
      return undefined as never
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return
    const metadata = newMetadata.trim() ? validateMetadata() : null
    if (newMetadata.trim() && metadata === undefined) return // validation failed

    setCreating(true)
    setCreateError(null)
    try {
      await createDevice({
        name: newName.trim(),
        ...(newTemplateId ? { templateId: newTemplateId } : {}),
        ...(newClientId ? { clientId: newClientId } : {}),
        ...(metadata ? { metadata } : {}),
      })
      setCreateOpen(false)
      resetCreateForm()
      // Refresh list
      setLoading(true)
      await fetchDevices(1, pagination.limit, search).finally(() => setLoading(false))
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t('devices.create.errorCreate'))
    } finally {
      setCreating(false)
    }
  }

  function resetCreateForm() {
    setNewName('')
    setNewTemplateId('')
    setNewClientId('')
    setNewMetadata('')
    setMetadataError(null)
    setCreateError(null)
  }

  async function handleConfirmDelete() {
    if (!deleteId) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteDevice(deleteId)
      setDeleteId(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('devices.delete.errorDelete'))
    } finally {
      setDeleting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('devices.list.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('devices.list.subtitle')}
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t('devices.list.newButton')}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={t('devices.list.searchPlaceholder')}
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('devices.list.colName')}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('devices.list.colStatus')}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                {t('devices.list.colTemplate')}
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                {t('devices.list.colLastSeen')}
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading &&
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-t animate-pulse">
                  <td className="px-4 py-3">
                    <div className="h-4 bg-muted rounded w-3/4" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 bg-muted rounded w-16" />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="h-4 bg-muted rounded w-24" />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="h-4 bg-muted rounded w-32" />
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              ))}

            {!loading && devices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Server className="h-12 w-12 opacity-30" />
                    <p className="font-medium">
                      {search ? t('devices.list.emptySearch') : t('devices.list.empty')}
                    </p>
                    {!search && (
                      <p className="text-xs">{t('devices.list.emptySubtitle')}</p>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {!loading &&
              devices.map((device) => (
                <tr
                  key={device.id}
                  className="border-t hover:bg-muted/30 cursor-pointer group transition-colors"
                  onClick={() => navigate(`/app/devices/${device.id}`)}
                >
                  <td className="px-4 py-3 font-medium">{device.name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge isOnline={device.isOnline} status={device.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {device.templateId ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {formatLastSeen(device.lastSeen)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditDeviceId(device.id)
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteId(device.id)
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {t('devices.list.pagination', {
              page: pagination.page,
              totalPages: pagination.totalPages,
              total: pagination.total,
            })}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => handlePageChange(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              {t('common.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => handlePageChange(pagination.page + 1)}
            >
              {t('common.next')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Create dialog ──────────────────────────────────────────────────── */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) resetCreateForm()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('devices.create.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {createError && (
              <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
                {createError}
              </div>
            )}
            <div className="space-y-1">
              <Label>{t('common.nameLabel')}</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('devices.create.namePlaceholder')}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>{t('devices.create.templateLabel')}</Label>
              {loadingDropdowns ? (
                <div className="h-9 bg-muted animate-pulse rounded-md" />
              ) : (
                <Select value={newTemplateId} onValueChange={(v) => setNewTemplateId(v ?? '')}>
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
                <Select value={newClientId} onValueChange={(v) => setNewClientId(v ?? '')}>
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
                value={newMetadata}
                onChange={(e) => {
                  setNewMetadata(e.target.value)
                  setMetadataError(null)
                }}
                placeholder='{"key": "value"}'
              />
              {metadataError && (
                <p className="text-destructive text-xs">{metadataError}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating ? t('common.creating') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ────────────────────────────────────────────────────── */}
      {editDeviceId && (
        <EditDeviceDialog
          deviceId={editDeviceId}
          onClose={() => setEditDeviceId(null)}
          onSuccess={async () => {
            setEditDeviceId(null)
            setLoading(true)
            await fetchDevices(pagination.page, pagination.limit, search).finally(() =>
              setLoading(false)
            )
          }}
        />
      )}

      {/* ── Delete confirmation dialog ─────────────────────────────────────── */}
      <Dialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('devices.delete.title')}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            {deleteError && (
              <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
                {deleteError}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {t('devices.delete.confirm')}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteId(null)
                setDeleteError(null)
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? t('common.deleting') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
