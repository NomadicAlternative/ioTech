import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, LayoutDashboard, Edit, Trash2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { useDashboardStore } from './dashboardStore'
import { useClientContext } from '@/stores/clientContext'
import { listClients } from '@/features/devices/api'

export function DashboardListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { dashboards, fetchDashboards, createDashboard, deleteDashboard } = useDashboardStore()
  const { activeClient, setActiveClient } = useClientContext()
  const [clients, setClients] = useState<any[]>([])

  const filteredDashboards = useMemo(() => {
    if (!activeClient) return dashboards
    return dashboards.filter(d => (d as any).clientId === activeClient.id)
  }, [dashboards, activeClient])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchDashboards()
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar'))
      .finally(() => setLoading(false))
    listClients().then(setClients).catch(() => {})
  }, [fetchDashboards])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const dashboard = await createDashboard(newName.trim(), newDesc.trim(), activeClient?.id)
      setCreateOpen(false)
      setNewName('')
      setNewDesc('')
      navigate(`/app/dashboards/${dashboard.id}/edit`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.list.failedCreate'))
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(t('dashboard.list.confirmDelete'))) return
    await deleteDashboard(id).catch(() => {/* ignore */})
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border)]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t('dashboard.list.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('dashboard.list.subtitle')}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('dashboard.list.newButton')}
        </Button>
      </div>

      {/* Client filter */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Cliente:</span>
        <select
          className="rounded-lg border border-[var(--border)] bg-card px-3 py-1.5 text-sm"
          value={activeClient?.id || ''}
          onChange={e => {
            const id = e.target.value
            if (!id) { setActiveClient(null); return }
            const c = clients.find((cl: any) => cl.id === id)
            if (c) setActiveClient({ id: c.id, name: c.name })
          }}>
          <option value="">Todos los clientes</option>
          {activeClient && !clients.find((c: any) => c.id === activeClient.id) && (
            <option value={activeClient.id}>{activeClient.name}</option>
          )}
          {clients.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dashboard grid */}
      {!loading && filteredDashboards.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <LayoutDashboard className="h-16 w-16 text-muted-foreground/40" />
          <div>
            <p className="text-lg font-medium">{t('dashboard.list.empty')}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('dashboard.list.emptySubtitle')}
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('dashboard.list.createButton')}
          </Button>
        </div>
      )}

      {!loading && filteredDashboards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDashboards.map((dashboard) => (
            <Card
              key={dashboard.id}
              className="cursor-pointer hover:shadow-md transition-all group border hover:border-[var(--blue)]/20 relative overflow-hidden"
              onClick={() => navigate(`/app/dashboards/${dashboard.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base truncate">{dashboard.name}</CardTitle>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/app/dashboards/${dashboard.id}/edit`)
                      }}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={(e) => handleDelete(dashboard.id, e)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {dashboard.description && (
                  <CardDescription className="text-xs line-clamp-2">
                    {dashboard.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex items-center justify-between pt-0">
                <Badge variant="secondary" className="text-xs font-semibold"
                       style={{ background: 'color-mix(in oklch, var(--brand-cerulean) 12%, transparent)', color: 'var(--brand-cerulean)' }}>
                  {t('dashboard.list.widgets', { count: dashboard.widgetCount ?? 0 })}
                </Badge>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {dashboard.updatedAt ? new Date(dashboard.updatedAt).toLocaleDateString() : '—'}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dashboard.create.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>{t('common.nameLabel')}</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('dashboard.create.namePlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>{t('common.descLabel')}</Label>
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder={t('dashboard.create.descPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating ? t('common.creating') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
