import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Building2, Users, Cpu, ArrowLeft, Clock } from 'lucide-react'
import { fetchTenantDetail, type TenantDetail } from './adminApi'

export function InstallerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [detail, setDetail] = useState<TenantDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    let cancelled = false
    setLoading(true)
    setError(null)

    fetchTenantDetail(id)
      .then((data) => {
        if (!cancelled) {
          setDetail(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load')
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [id])

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl sm:text-2xl font-bold">{t('admin.installerDetail', 'Installer Details')}</h1>
        </div>
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-center">
          <p className="text-destructive text-sm">{t('admin.detailError', 'Failed to load tenant details')}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </div>
          <div className="h-6 w-48 rounded bg-muted animate-pulse" />
        </div>
        <div className="rounded-xl border p-6 space-y-4 animate-pulse">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-8 w-64 rounded bg-muted" />
          <div className="h-4 w-48 rounded bg-muted" />
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="h-20 rounded-lg bg-muted" />
            <div className="h-20 rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    )
  }

  if (!detail) return null

  const isTrial = detail.trialStatus === 'trial'
  const statusLabel = isTrial ? 'admin.trial' : 'admin.active'

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold">{detail.name}</h1>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isTrial
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300'
                  : 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-300'
              }`}
            >
              <Clock className="w-3 h-3" />
              {t(statusLabel)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{detail.email}</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <Cpu className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('admin.devices')}</p>
            <p className="text-2xl font-bold">{detail.deviceCount.toLocaleString()}</p>
          </div>
        </div>

        <div className="rounded-xl border p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('admin.users')}</p>
            <p className="text-2xl font-bold">{detail.userCount.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Tenant info card */}
      <div className="rounded-xl border p-5 space-y-3">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
          {t('admin.tenantInfo', 'Tenant Information')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">{t('admin.tenantId', 'Tenant ID')}</span>
            <p className="font-mono font-medium mt-0.5">{detail.id}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t('admin.email')}</span>
            <p className="font-medium mt-0.5">{detail.email}</p>
          </div>
          {detail.trialEndsAt && (
            <div>
              <span className="text-muted-foreground">{t('admin.trialEndsAt', 'Trial Ends')}</span>
              <p className="font-medium mt-0.5">
                {new Date(detail.trialEndsAt).toLocaleDateString()}
              </p>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">{t('admin.createdAt', 'Created')}</span>
            <p className="font-medium mt-0.5">
              {new Date(detail.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
