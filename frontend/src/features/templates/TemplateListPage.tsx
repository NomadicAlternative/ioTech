import { useEffect, useState, useRef } from 'react'
import { Plus, LayoutTemplate, Edit, Trash2, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
      .catch((err) => setPageError(err instanceof Error ? err.message : 'Error al cargar plantillas'))
      .finally(() => setPageLoading(false))
  }, [fetchTemplates])

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSearchChange(value: string) {
    setSearch(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setPageLoading(true)
      fetchTemplates(1, pagination.limit, value)
        .catch((err) => setPageError(err instanceof Error ? err.message : 'Error al buscar'))
        .finally(() => setPageLoading(false))
    }, 300)
  }

  function handlePageChange(newPage: number) {
    setPageLoading(true)
    fetchTemplates(newPage, pagination.limit, search)
      .catch((err) => setPageError(err instanceof Error ? err.message : 'Error al paginar'))
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
      setDeleteError(err instanceof Error ? err.message : 'Error al eliminar plantilla')
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
        <div>
          <h1 className="text-2xl font-bold">Plantillas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Administrá las plantillas de dispositivos y sus datastreams
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva plantilla
        </Button>
      </div>

      {/* Error */}
      {displayError && (
        <div className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm">
          {displayError}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar plantillas…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                Descripción
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Datastreams</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-t animate-pulse">
                  <td className="px-4 py-3">
                    <div className="h-4 bg-muted rounded w-3/4" />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="h-4 bg-muted rounded w-40" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 bg-muted rounded w-8" />
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              ))}

            {!isLoading && templates.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <LayoutTemplate className="h-12 w-12 opacity-30" />
                    <p className="font-medium">
                      {search ? 'Sin resultados para la búsqueda' : 'No hay plantillas aún'}
                    </p>
                    {!search && (
                      <p className="text-xs">Creá tu primera plantilla para comenzar.</p>
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
                  <td className="px-4 py-3 font-medium">{template.name}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {template.description ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {template.datastreams.length}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditTemplateId(template.id)
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
                          setDeleteId(template.id)
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
      {!isLoading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Página {pagination.page} de {pagination.totalPages} ({pagination.total} plantillas)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => handlePageChange(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => handlePageChange(pagination.page + 1)}
            >
              Siguiente
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
            <DialogTitle>Eliminar plantilla</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            {deleteError && (
              <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
                {deleteError}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              ¿Estás seguro que querés eliminar esta plantilla? Esta acción no se puede deshacer.
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
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
