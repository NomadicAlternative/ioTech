import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Cpu, Activity, Building2 } from 'lucide-react'
import { fetchDashboard, type DashboardKpi } from './adminApi'

interface KpiCard {
  labelKey: string
  value: number
  icon: React.ReactNode
  iconBg: string
}

export function DashboardPage() {
  const { t } = useTranslation()
  const [kpis, setKpis] = useState<DashboardKpi | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchDashboard()
      .then((data) => {
        if (!cancelled) {
          setKpis(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard')
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [])

  const cards: KpiCard[] = kpis
    ? [
        {
          labelKey: 'admin.totalUsers',
          value: kpis.totalUsers,
          icon: <Users className="w-5 h-5" />,
          iconBg: 'bg-blue-500/10 text-blue-600',
        },
        {
          labelKey: 'admin.totalDevices',
          value: kpis.totalDevices,
          icon: <Cpu className="w-5 h-5" />,
          iconBg: 'bg-purple-500/10 text-purple-600',
        },
        {
          labelKey: 'admin.activeDevices',
          value: kpis.activeDevices,
          icon: <Activity className="w-5 h-5" />,
          iconBg: 'bg-green-500/10 text-green-600',
        },
        {
          labelKey: 'admin.totalTenants',
          value: kpis.totalTenants,
          icon: <Building2 className="w-5 h-5" />,
          iconBg: 'bg-amber-500/10 text-amber-600',
        },
      ]
    : []

  return (
    <div className="space-y-6">
      <div className="pb-4 mb-4 border-b border-[var(--border)]">
        <h1 className="text-xl sm:text-2xl font-bold">{t('admin.dashboardTitle', 'Admin Dashboard')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('admin.dashboardSubtitle', 'Overview of all tenants and devices')}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-center">
          <p className="text-destructive text-sm">{t('admin.dashboardError', 'Failed to load dashboard data')}</p>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border p-5 animate-pulse">
              <div className="h-4 w-24 rounded bg-muted mb-3" />
              <div className="h-8 w-16 rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <div
              key={card.labelKey}
              className="rounded-xl border p-5 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {t(card.labelKey)}
                </span>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.iconBg}`}>
                  {card.icon}
                </div>
              </div>
              <span className="text-3xl font-bold tracking-tight">
                {card.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
