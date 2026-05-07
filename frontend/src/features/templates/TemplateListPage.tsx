import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, LayoutTemplate, Edit, Trash2, ChevronLeft, ChevronRight, Search, FileCode2, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useTemplateStore } from './templateStore'
import { CreateTemplateDialog } from './components/CreateTemplateDialog'
import { EditTemplateDialog } from './components/EditTemplateDialog'

// ─── Page component ───────────────────────────────────────────────────────────

export function TemplateListPage() {
  const { t } = useTranslation()
  const { templates, pagination, search, loading, error, fetchTemplates, deleteTemplate, setSearch } =
    useTemplateStore()

  const [pageLoading, setPageLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

  // ── Dialog state ──
  const [createOpen, setCreateOpen] = useState(false)
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null)

  // ── Delete dialog state ──
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // ── Search debounce ──
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initial fetch
  useEffect(() => {
    setPageLoading(true)
    fetchTemplates(1, 10, '')
      .catch((err) => setPageError(err instanceof Error ? err.message : t('templates.list.errorLoad')))
      .finally(() => setPageLoading(false))
  }, [fetchTemplates])

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSearchChange(value: string) {
    setSearch(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setPageLoading(true)
      fetchTemplates(1, pagination.limit, value)
        .catch((err) => setPageError(err instanceof Error ? err.message : t('templates.list.errorSearch')))
        .finally(() => setPageLoading(false))
    }, 300)
  }

  function handlePageChange(newPage: number) {
    setPageLoading(true)
    fetchTemplates(newPage, pagination.limit, search)
      .catch((err) => setPageError(err instanceof Error ? err.message : t('templates.list.errorPaginate')))
      .finally(() => setPageLoading(false))
  }

  async function handleConfirmDelete() {
    if (!deleteId) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteTemplate(deleteId)
      setDeleteId(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('templates.delete.errorDelete'))
    } finally {
      setDeleting(false)
    }
  }

  async function handleRefresh() {
    setPageLoading(true)
    await fetchTemplates(pagination.page, pagination.limit, search).finally(() =>
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
            <FileCode2 className="w-5 h-5" style={{ color: 'var(--brand-imperial)' }} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{t('templates.list.title')}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {t('templates.list.subtitle')}
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} style={{ background: 'var(--brand-imperial)' }}>
          <Plus className="h-4 w-4 mr-2" />
          {t('templates.list.newButton')}
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
          placeholder={t('templates.list.searchPlaceholder')}
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'color-mix(in oklch, var(--brand-imperial) 5%, transparent)' }}>
              <th className="text-left px-5 py-3.5 font-semibold text-foreground/70 text-xs uppercase tracking-wide">{t('templates.list.colName')}</th>
              <th className="text-left px-5 py-3.5 font-semibold text-foreground/70 text-xs uppercase tracking-wide hidden md:table-cell">
                {t('templates.list.colDescription')}
              </th>
              <th className="text-left px-5 py-3.5 font-semibold text-foreground/70 text-xs uppercase tracking-wide">{t('templates.list.colDatastreams')}</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-t animate-pulse">
                  <td className="px-5 py-4">
                    <div className="h-4 bg-muted rounded w-3/4" />
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell">
                    <div className="h-4 bg-muted rounded w-40" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="h-4 bg-muted rounded w-8" />
                  </td>
                  <td className="px-5 py-4" />
                </tr>
              ))}

            {!isLoading && templates.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-20 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                         style={{ background: 'color-mix(in oklch, var(--brand-imperial) 8%, transparent)' }}>
                      <LayoutTemplate className="h-7 w-7 opacity-40" style={{ color: 'var(--brand-imperial)' }} />
                    </div>
                    <p className="font-medium">
                      {search ? t('templates.list.emptySearch') : t('templates.list.empty')}
                    </p>
                    {!search && (
                      <p className="text-xs">{t('templates.list.emptySubtitle')}</p>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {!isLoading &&
              templates.map((template) => (
                <tr
                  key={template.id}
                  className="border-t hover:bg-muted/30 cursor-pointer group transition-colors"
                  onClick={() => setEditTemplateId(template.id)}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                           style={{ background: 'color-mix(in oklch, var(--brand-cerulean) 12%, transparent)' }}>
                        <FileCode2 className="w-3.5 h-3.5" style={{ color: 'var(--brand-cerulean)' }} />
                      </div>
                      <span className="font-semibold">{template.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground hidden md:table-cell">
                    {template.description ?? '—'}
                  </td>
                  <td className="px-5 py-4">
                    <Badge
                      className="gap-1.5 border-0 font-semibold"
                      style={{
                        background: 'color-mix(in oklch, var(--brand-cerulean) 12%, transparent)',
                        color: 'var(--brand-cerulean)',
                      }}
                    >
                      <Database className="w-3 h-3" />
                      {template.datastreams.length}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); setEditTemplateId(template.id) }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteId(template.id) }}
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
      {!isLoading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {t('templates.list.pagination', {
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
        <CreateTemplateDialog
          onClose={() => setCreateOpen(false)}
          onSuccess={async () => {
            setCreateOpen(false)
            await handleRefresh()
          }}
        />
      )}

      {/* ── Edit dialog ────────────────────────────────────────────────────── */}
      {editTemplateId && (
        <EditTemplateDialog
          templateId={editTemplateId}
          onClose={() => setEditTemplateId(null)}
          onSuccess={async () => {
            setEditTemplateId(null)
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
            <DialogTitle>{t('templates.delete.title')}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            {deleteError && (
              <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
                {deleteError}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {t('templates.delete.confirm')}
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
