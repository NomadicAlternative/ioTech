import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Plus, Share2, Save, Loader2 } from 'lucide-react'
import GridLayout, { type Layout, type LayoutItem } from 'react-grid-layout'
import { v4 as uuidv4 } from 'uuid'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useDashboardStore } from './dashboardStore'
import { useAuthStore } from '@/features/auth/authStore'
import { WidgetRenderer } from '@/features/widgets/WidgetRenderer'
import { WidgetConfigPanel } from '@/features/widgets/WidgetConfigPanel'
import { WIDGET_TYPES } from '@/features/widgets/registry'
import { fetchClients, shareDashboard, revokeDashboardShare, fetchDashboardSharedClients } from './api'
import type { WidgetLayoutEntry } from '@/features/widgets/types'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

export function DashboardEditorPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const userRole = useAuthStore((s) => s.user?.role)
  const isInstaller = userRole === 'installer' || userRole === 'admin'

  const {
    currentDashboard,
    layout,
    fetchDashboard,
    clearCurrent,
    setLayout,
    isSaving,
    saveError,
    setIsEditing,
  } = useDashboardStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Share dialog state
  const [shareOpen, setShareOpen] = useState(false)
  const [clients, setClients] = useState<{ id: string; name: string; email: string }[]>([])
  const [sharedClientIds, setSharedClientIds] = useState<string[]>([])
  const [sharingLoading, setSharingLoading] = useState(false)

  useEffect(() => {
    if (!id) return
    setIsEditing(true)
    fetchDashboard(id)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
    return () => {
      clearCurrent()
      setIsEditing(false)
    }
  }, [id, fetchDashboard, clearCurrent, setIsEditing])

  // Load share data when dialog opens
  useEffect(() => {
    if (!shareOpen || !id) return
    Promise.resolve()
      .then(() => setSharingLoading(true))
      .then(() => Promise.all([fetchClients(), fetchDashboardSharedClients(id)]))
      .then(([c, shared]) => {
        setClients(c)
        setSharedClientIds(shared)
      })
      .catch(() => {/* ignore */})
      .finally(() => setSharingLoading(false))
  }, [shareOpen, id])

  const handleLayoutChange = useCallback(
    (newGridLayout: Layout) => {
      const updated: WidgetLayoutEntry[] = newGridLayout.map((gl) => {
        const existing = layout.find((e) => e.i === gl.i)
        return existing
          ? { ...existing, x: gl.x, y: gl.y, w: gl.w, h: gl.h }
          : existing!
      }).filter(Boolean)
      setLayout(updated)
    },
    [layout, setLayout]
  )

  const handleAddWidget = (widgetType: string) => {
    const def = WIDGET_TYPES.find((w) => w.type === widgetType)
    if (!def) return

    const newEntry: WidgetLayoutEntry = {
      i: uuidv4(),
      x: 0,
      y: Infinity, // adds to bottom
      w: def.defaultSize.w,
      h: def.defaultSize.h,
      widgetType: def.type,
      config: {
        name: def.label,
        deviceId: null,
        datastreamKey: null,
        settings: { ...def.defaultConfig },
      },
    }
    setLayout([...layout, newEntry])
  }

  const handleToggleShare = async (clientId: string) => {
    if (!id) return
    const isShared = sharedClientIds.includes(clientId)
    try {
      if (isShared) {
        await revokeDashboardShare(id, clientId)
        setSharedClientIds((prev) => prev.filter((c) => c !== clientId))
      } else {
        await shareDashboard(id, clientId)
        setSharedClientIds((prev) => [...prev, clientId])
      }
    } catch {/* ignore */}
  }

  const gridLayout: LayoutItem[] = layout.map((e) => ({
    i: e.i,
    x: e.x,
    y: e.y,
    w: e.w,
    h: e.h,
    minW: 2,
    minH: 2,
  }))

  // SC-DASH-005: Redirect clients away from the edit route → view mode.
  // Guard is placed here (after all hooks) to comply with Rules of Hooks.
  if (!isInstaller) {
    return <Navigate to={`/app/dashboards/${id}`} replace />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        {t('dashboard.editor.loading')}
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> {t('common.back')}
        </Button>
        <div className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm">{error}</div>
      </div>
    )
  }

  return (
    <div className="flex h-full gap-0">
      {/* ─── Widget Palette Sidebar ──────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 border-r bg-background overflow-y-auto p-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-3">
          {t('dashboard.editor.widgetsPalette')}
        </p>
        {WIDGET_TYPES.map((def) => (
          <button
            key={def.type}
            className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent text-sm transition-colors"
            onClick={() => handleAddWidget(def.type)}
          >
            <Plus className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span>{def.label}</span>
          </button>
        ))}
      </aside>

      {/* ─── Editor Canvas ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-background flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/app/dashboards/${id}`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <span className="font-semibold text-sm">{currentDashboard?.name ?? 'Editor'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Save indicator */}
            {isSaving && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('dashboard.editor.saving')}
              </Badge>
            )}
            {!isSaving && !saveError && layout.length > 0 && (
              <Badge variant="secondary" className="gap-1 text-xs text-green-600">
                <Save className="h-3 w-3" />
                {t('dashboard.editor.saved')}
              </Badge>
            )}
            {saveError && (
              <Badge variant="destructive" className="text-xs">{t('dashboard.editor.errorSaving')}</Badge>
            )}
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setShareOpen(true)}>
              <Share2 className="h-4 w-4" /> {t('dashboard.editor.shareButton')}
            </Button>
            <Button size="sm" onClick={() => navigate(`/app/dashboards/${id}`)}>
              {t('dashboard.editor.done')}
            </Button>
          </div>
        </div>

        {/* Grid canvas */}
        <div className="flex-1 overflow-auto p-4 bg-muted/30">
          {layout.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
              <p className="text-muted-foreground">{t('dashboard.editor.emptyCanvas')}</p>
            </div>
          ) : (
            <GridLayout
              className="layout"
              layout={gridLayout}
              width={1200}
              gridConfig={{ cols: 12, rowHeight: 80, margin: [12, 12] as [number, number] }}
              dragConfig={{ enabled: true }}
              resizeConfig={{ enabled: true }}
              onLayoutChange={handleLayoutChange}
            >
              {layout.map((entry) => (
                <div key={entry.i}>
                  <WidgetRenderer entry={entry} isEditing />
                </div>
              ))}
            </GridLayout>
          )}
        </div>
      </div>

      {/* ─── Widget Config Panel ─────────────────────────────────────────── */}
      <WidgetConfigPanel />

      {/* ─── Share Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dashboard.share.title')}</DialogTitle>
          </DialogHeader>
          {sharingLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : clients.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t('dashboard.share.noClients')}</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto py-2">
              {clients.map((client) => {
                const isShared = sharedClientIds.includes(client.id)
                return (
                  <div
                    key={client.id}
                    className="flex items-center justify-between px-3 py-2 rounded-md border"
                  >
                    <div>
                      <p className="text-sm font-medium">{client.name}</p>
                      <p className="text-xs text-muted-foreground">{client.email}</p>
                    </div>
                    <Button
                      variant={isShared ? 'destructive' : 'default'}
                      size="sm"
                      onClick={() => handleToggleShare(client.id)}
                    >
                      {isShared ? t('dashboard.share.revoke') : t('dashboard.share.share')}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
