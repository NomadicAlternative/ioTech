import { useEffect, useLayoutEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Edit, ArrowLeft } from 'lucide-react'
import { Responsive as ResponsiveGridLayout } from 'react-grid-layout'
import type { Layout } from 'react-grid-layout'
import { Button } from '@/components/ui/button'
import { useDashboardStore } from './dashboardStore'
import { useAuthStore } from '@/features/auth/authStore'
import { WidgetRenderer } from '@/features/widgets/WidgetRenderer'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

export function DashboardViewPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentDashboard, layout, fetchDashboard, clearCurrent } = useDashboardStore()
  const user = useAuthStore((s) => s.user)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [canvasWidth, setCanvasWidth] = useState(1200)
  const canvasRef = useRef<HTMLDivElement>(null)

  const isInstaller = user?.role === 'installer' || user?.role === 'admin'

  useEffect(() => {
    if (!id) return
    fetchDashboard(id)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
    return () => clearCurrent()
  }, [id, fetchDashboard, clearCurrent])

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        {t('dashboard.view.loading')}
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

  // Convert layout entries to react-grid-layout format
  const gridLayout: Layout = layout.map((e) => ({
    i: e.i,
    x: e.x,
    y: e.y,
    w: e.w,
    h: e.h,
    static: true,
  }))

  return (
    <div className="space-y-4" ref={canvasRef}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/app/dashboards')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{currentDashboard?.name ?? t('dashboard.view.fallbackTitle')}</h1>
            {currentDashboard?.description && (
              <p className="text-sm text-muted-foreground">{currentDashboard.description}</p>
            )}
          </div>
        </div>
        {isInstaller && (
          <Button onClick={() => navigate(`/app/dashboards/${id}/edit`)} className="gap-2">
            <Edit className="h-4 w-4" /> {t('dashboard.view.editButton')}
          </Button>
        )}
      </div>

      {/* Grid */}
      {layout.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-2">
          <p className="text-muted-foreground">{t('dashboard.view.empty')}</p>
          {isInstaller && (
            <Button variant="outline" onClick={() => navigate(`/app/dashboards/${id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" /> {t('dashboard.view.addWidgets')}
            </Button>
          )}
        </div>
      ) : (
        <ResponsiveGridLayout
            className="layout"
            layouts={{ lg: gridLayout }}
            breakpoints={{ lg: 1200, md: 996, sm: 768 }}
            cols={{ lg: 12, md: 10, sm: 6 }}
            rowHeight={80}
            margin={[12, 12]}
            width={canvasWidth || 1200}
            isDraggable={false}
            isResizable={false}
          >
            {layout.map((entry) => (
              <div key={entry.i}>
                <WidgetRenderer entry={entry} isEditing={false} />
              </div>
            ))}
          </ResponsiveGridLayout>
      )}
    </div>
  )
}
