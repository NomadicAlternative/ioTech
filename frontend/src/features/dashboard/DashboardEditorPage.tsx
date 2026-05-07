import { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Plus, Share2, Save, Loader2, Gauge, Hash, TrendingUp, Circle, ToggleLeft, MousePointerClick, BarChart2, AlignLeft, MapPin } from 'lucide-react'
import { Responsive as ResponsiveGridLayout } from 'react-grid-layout'
import type { Layout } from 'react-grid-layout'
import { v4 as uuidv4 } from 'uuid'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { useDashboardStore } from './dashboardStore'
import { useAuthStore } from '@/features/auth/authStore'
import { WidgetRenderer } from '@/features/widgets/WidgetRenderer'
import { WidgetConfigPanel } from '@/features/widgets/WidgetConfigPanel'
import { WIDGET_TYPES } from '@/features/widgets/registry'
import { fetchClients, shareDashboard, revokeDashboardShare, fetchDashboardSharedClients } from './api'
import type { WidgetLayoutEntry } from '@/features/widgets/types'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const WIDGET_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  gauge: Gauge,
  number_display: Hash,
  line_chart: TrendingUp,
  status_indicator: Circle,
  toggle_switch: ToggleLeft,
  button: MousePointerClick,
  stat_card: BarChart2,
  progress_bar: AlignLeft,
  map: MapPin,
}

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
  const [canvasWidth, setCanvasWidth] = useState(1200)
  const canvasRef = useRef<HTMLDivElement>(null)

  // Share dialog state
  const [shareOpen, setShareOpen] = useState(false)
  const [clients, setClients] = useState<{ id: string; name: string; email: string }[]>([])
  const [sharedClientIds, setSharedClientIds] = useState<string[]>([])
  const [sharingLoading, setSharingLoading] = useState(false)
  const [currentBreakpoint, setCurrentBreakpoint] = useState<string>('lg')
  const [paletteOpen, setPaletteOpen] = useState(false)

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

  // Measure canvas width for the grid
  useLayoutEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setCanvasWidth(entry.contentRect.width)
    })
    ro.observe(el)
    setCanvasWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])

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

  const gridLayout: Layout = layout.map((e) => ({
    i: e.i,
    x: e.x,
    y: e.y,
    w: e.w,
    h: e.h,
    minW: 2,
    minH: 2,
  }))

  // Mobile layout: stack vertically in single column
  let mobileY = 0
  const xsLayout: Layout = layout.map((e) => {
    const item = { i: e.i, x: 0, y: mobileY, w: 1, h: e.h, minW: 1, minH: 2 }
    mobileY += e.h
    return item
  })

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
    <div className="flex -m-6 h-[calc(100vh-3.5rem)] gap-0 overflow-hidden">
      {/* ─── Widget Palette Sidebar (desktop only) ──────────────────────── */}
      <aside className="hidden lg:flex lg:w-56 lg:flex-shrink-0 flex-col border-r bg-background overflow-y-auto p-3 space-y-2">
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
        <div ref={canvasRef} className="flex-1 overflow-auto p-4 bg-muted/30">
          {layout.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
              <p className="text-muted-foreground">{t('dashboard.editor.emptyCanvas')}</p>
            </div>
          ) : (
            <ResponsiveGridLayout
              className="layout"
              layouts={{ lg: gridLayout, md: gridLayout, sm: gridLayout, xs: xsLayout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 1 }}
              rowHeight={80}
              margin={[12, 12]}
              width={canvasWidth || 1200}
              isDraggable={currentBreakpoint !== 'xs'}
              isResizable={currentBreakpoint !== 'xs'}
              onBreakpointChange={(bp) => setCurrentBreakpoint(bp)}
              onLayoutChange={(newLayout) => handleLayoutChange(newLayout)}
            >
              {layout.map((entry) => (
                <div key={entry.i}>
                  <WidgetRenderer entry={entry} isEditing />
                </div>
              ))}
            </ResponsiveGridLayout>
          )}
        </div>
      </div>

      {/* ─── Widget Config Panel ─────────────────────────────────────────── */}
      <WidgetConfigPanel />

      {/* ─── Mobile: floating add-widget button ──────────────────────────── */}
      <button
        onClick={() => setPaletteOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white"
        style={{ background: 'var(--brand-imperial, #01295F)' }}
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* ─── Mobile: widget palette bottom sheet ──────────────────────────── */}
      <Sheet open={paletteOpen} onOpenChange={setPaletteOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl px-4 pb-8 pt-3 max-h-[58vh] overflow-y-auto border-0"
          style={{
            background: 'linear-gradient(180deg, #001a3d 0%, #01295F 100%)',
          }}
        >
          {/* Drag handle */}
          <div className="flex justify-center -mt-1 mb-3">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          <SheetHeader className="mb-1">
            <SheetTitle className="text-white/90 text-base font-semibold text-center">
              {t('dashboard.editor.widgetsPalette')}
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-wrap gap-2 mt-2">
            {WIDGET_TYPES.map((def) => {
              const Icon = WIDGET_ICONS[def.type]
              return (
                <button
                  key={def.type}
                  onClick={() => { handleAddWidget(def.type); setPaletteOpen(false) }}
                  className="flex flex-col items-center gap-2 p-3.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/12 active:scale-95 transition-all text-center"
                  style={{ width: 'calc(33.333% - 0.55rem)', minWidth: '90px' }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10">
                    {Icon && <Icon className="w-5 h-5 text-amber-400" />}
                  </div>
                  <span className="text-[11px] font-medium text-white/80 leading-tight">{def.label}</span>
                </button>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>

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
