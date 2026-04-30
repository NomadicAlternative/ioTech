import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Users, Edit, Trash2, ChevronLeft, ChevronRight, Search, Mail, Phone, MapPin, UserCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useClientStore } from './clientStore'
import { CreateClientDialog } from './components/CreateClientDialog'
import { EditClientDialog } from './components/EditClientDialog'

// ─── Page component ───────────────────────────────────────────────────────────

export function ClientListPage() {
  const { t } = useTranslation()
  const { clients, pagination, search, loading, error, fetchClients, deleteClient, setSearch } =
    useClientStore()

  const [pageLoading, setPageLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

  // ── Dialog state ──
  const [createOpen, setCreateOpen] = useState(false)
  const [editClientId, setEditClientId] = useState<string | null>(null)

  // ── Delete dialog state ──
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // ── Search debounce ──
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initial fetch
  useEffect(() => {
    setPageLoading(true)
    fetchClients(1, 10, '')
      .catch((err) => setPageError(err instanceof Error ? err.message : t('clients.list.errorLoad')))
      .finally(() => setPageLoading(false))
  }, [fetchClients])

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSearchChange(value: string) {
    setSearch(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setPageLoading(true)
      fetchClients(1, pagination.limit, value)
        .catch((err) => setPageError(err instanceof Error ? err.message : t('clients.list.errorSearch')))
        .finally(() => setPageLoading(false))
    }, 300)
  }

  function handlePageChange(newPage: number) {
    setPageLoading(true)
    fetchClients(newPage, pagination.limit, search)
      .catch((err) => setPageError(err instanceof Error ? err.message : t('clients.list.errorPaginate')))
      .finally(() => setPageLoading(false))
  }

  async function handleConfirmDelete() {
    if (!deleteId) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteClient(deleteId)
      setDeleteId(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('clients.delete.errorDelete'))
    } finally {
      setDeleting(false)
    }
  }

  async function handleRefresh() {
    setPageLoading(true)
    await fetchClients(pagination.page, pagination.limit, search).finally(() =>
      setPageLoading(false)
    )
  }

  const isLoading = pageLoading || loading
  const displayError = pageError ?? error

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
               style={{ background: 'color-mix(in oklch, var(--brand-imperial) 10%, transparent)' }}>
            <Users className="w-5 h-5" style={{ color: 'var(--brand-imperial)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('clients.list.title')}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {t('clients.list.subtitle')}
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} style={{ background: 'var(--brand-imperial)' }}>
          <Plus className="h-4 w-4 mr-2" />
          {t('clients.list.newButton')}
        </Button>
      </div>

      {/* Error */}
      {displayError && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 text-destructive px-4 py-3 text-sm">
          {displayError}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9 h-10"
          placeholder={t('clients.list.searchPlaceholder')}
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'color-mix(in oklch, var(--brand-imperial) 5%, transparent)' }}>
              <th className="text-left px-5 py-3.5 font-semibold text-foreground/70 text-xs uppercase tracking-wide">{t('clients.list.colName')}</th>
              <th className="text-left px-5 py-3.5 font-semibold text-foreground/70 text-xs uppercase tracking-wide hidden md:table-cell">
                {t('clients.list.colEmail')}
              </th>
              <th className="text-left px-5 py-3.5 font-semibold text-foreground/70 text-xs uppercase tracking-wide hidden lg:table-cell">
                {t('clients.list.colPhone')}
              </th>
              <th className="text-left px-5 py-3.5 font-semibold text-foreground/70 text-xs uppercase tracking-wide hidden lg:table-cell">
                {t('clients.list.colAddress')}
              </th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-t animate-pulse">
                  <td className="px-5 py-4"><div className="h-4 bg-muted rounded w-3/4" /></td>
                  <td className="px-5 py-4 hidden md:table-cell"><div className="h-4 bg-muted rounded w-40" /></td>
                  <td className="px-5 py-4 hidden lg:table-cell"><div className="h-4 bg-muted rounded w-28" /></td>
                  <td className="px-5 py-4 hidden lg:table-cell"><div className="h-4 bg-muted rounded w-36" /></td>
                  <td className="px-5 py-4" />
                </tr>
              ))}

            {!isLoading && clients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-20 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                         style={{ background: 'color-mix(in oklch, var(--brand-imperial) 8%, transparent)' }}>
                      <Users className="h-7 w-7 opacity-40" style={{ color: 'var(--brand-imperial)' }} />
                    </div>
                    <p className="font-medium">
                      {search ? t('clients.list.emptySearch') : t('clients.list.empty')}
                    </p>
                    {!search && (
                      <p className="text-xs">{t('clients.list.emptySubtitle')}</p>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {!isLoading &&
              clients.map((client) => (
                <tr
                  key={client.id}
                  className="border-t hover:bg-muted/30 cursor-pointer group transition-colors"
                  onClick={() => setEditClientId(client.id)}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white"
                        style={{ background: 'var(--brand-cerulean)' }}
                      >
                        {client.name?.[0]?.toUpperCase() ?? <UserCircle2 className="w-4 h-4" />}
                      </div>
                      <span className="font-semibold">{client.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground hidden md:table-cell">
                    {client.email
                      ? <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 opacity-50" />{client.email}</span>
                      : '—'}
                  </td>
                  <td className="px-5 py-4 text-muted-foreground hidden lg:table-cell">
                    {client.phone
                      ? <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 opacity-50" />{client.phone}</span>
                      : '—'}
                  </td>
                  <td className="px-5 py-4 text-muted-foreground hidden lg:table-cell">
                    {client.address
                      ? <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 opacity-50" />{client.address}</span>
                      : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); setEditClientId(client.id) }}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteId(client.id) }}>
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
      {!isLoading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {t('clients.list.pagination', {
              page: pagination.page,
              totalPages: pagination.totalPages,
              total: pagination.total,
            })}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1}
              onClick={() => handlePageChange(pagination.page - 1)}>
              <ChevronLeft className="h-4 w-4" />
              {t('common.previous')}
            </Button>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages}
              onClick={() => handlePageChange(pagination.page + 1)}>
              {t('common.next')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Create dialog ──────────────────────────────────────────────────── */}
      {createOpen && (
        <CreateClientDialog
          onClose={() => setCreateOpen(false)}
          onSuccess={async () => {
            setCreateOpen(false)
            await handleRefresh()
          }}
        />
      )}

      {/* ── Edit dialog ────────────────────────────────────────────────────── */}
      {editClientId && (
        <EditClientDialog
          clientId={editClientId}
          onClose={() => setEditClientId(null)}
          onSuccess={async () => {
            setEditClientId(null)
            await handleRefresh()
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
            <DialogTitle>{t('clients.delete.title')}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            {deleteError && (
              <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
                {deleteError}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {t('clients.delete.confirm')}
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
