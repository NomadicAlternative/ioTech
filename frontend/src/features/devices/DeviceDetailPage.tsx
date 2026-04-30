import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Clock, Usb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useDeviceStore } from './deviceStore'
import { useAuthStore } from '@/features/auth/authStore'
import { fetchDeviceTemplate, sendDeviceCommand } from './api'
import type { DeviceTemplate } from '@/features/widgets/types'
import { ProvisioningModal } from './components/ProvisioningModal'

const RELAY_COUNT = 7

export function DeviceDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentDevice, fetchDevice, clearCurrent } = useDeviceStore()
  const userRole = useAuthStore((s) => s.user?.role)
  const canSeeDatastreams = userRole === 'admin' || userRole === 'installer'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [template, setTemplate] = useState<DeviceTemplate | null>(null)
  const [provisioningOpen, setProvisioningOpen] = useState(false)

  // relay states: index 0 = relay 1, ..., index 6 = relay 7
  const [relayStates, setRelayStates] = useState<boolean[]>(Array(RELAY_COUNT).fill(false))
  const [relaySending, setRelaySending] = useState<boolean[]>(Array(RELAY_COUNT).fill(false))
  const [relayAnimating, setRelayAnimating] = useState<boolean[]>(Array(RELAY_COUNT).fill(false))

  useEffect(() => {
    if (!id) return
    setLoading(true)
    clearCurrent()
    fetchDevice(id)
      .catch((err) =>
        setError(err instanceof Error ? err.message : t('devices.detail.errorLoad'))
      )
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!currentDevice?.templateId) return
    fetchDeviceTemplate(currentDevice.templateId)
      .then(setTemplate)
      .catch(() => {/* template optional */})
  }, [currentDevice?.templateId])

  async function handleRelayToggle(relayIndex: number, newState: boolean) {
    if (!id) return
    const relayNum = relayIndex + 1

    // Optimistic update — respuesta inmediata al usuario
    setRelayStates((prev) => { const s = [...prev]; s[relayIndex] = newState; return s })

    // Animación solo al encender
    if (newState) {
      setRelayAnimating((prev) => { const s = [...prev]; s[relayIndex] = true; return s })
      setTimeout(() => {
        setRelayAnimating((prev) => { const s = [...prev]; s[relayIndex] = false; return s })
      }, 650)
    }

    setRelaySending((prev) => { const s = [...prev]; s[relayIndex] = true; return s })
    try {
      await sendDeviceCommand(id, relayNum, newState ? 'on' : 'off')
    } catch {
      // Revertir si falla
      setRelayStates((prev) => { const s = [...prev]; s[relayIndex] = !newState; return s })
    } finally {
      setRelaySending((prev) => { const s = [...prev]; s[relayIndex] = false; return s })
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !currentDevice) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/devices')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.back')}
        </Button>
        <div className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm">
          {error ?? t('devices.detail.notFound')}
        </div>
      </div>
    )
  }

  const device = currentDevice

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/devices')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('devices.detail.backButton')}
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{device.name}</h1>
          <Badge
            className="border-0 gap-1.5 font-semibold"
            style={device.isOnline
              ? { background: '#dcfce7', color: '#15803d' }
              : { background: '#fee2e2', color: '#b91c1c' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={device.isOnline
                ? { background: '#16a34a', boxShadow: '0 0 6px 2px rgba(22,163,74,0.5)' }
                : { background: '#dc2626', boxShadow: '0 0 6px 2px rgba(220,38,38,0.5)' }}
            />
            {device.isOnline ? t('devices.status.online') : t('devices.status.offline')}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          {device.lastSeen && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {t('devices.detail.lastSeen', { date: new Date(device.lastSeen).toLocaleString() })}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => setProvisioningOpen(true)}>
            <Usb className="h-4 w-4 mr-2" />
            Configurar dispositivo
          </Button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('devices.detail.cardId')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-sm break-all">{device.id}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('devices.detail.cardTemplate')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{template?.name ?? device.templateId ?? '—'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('devices.detail.cardCreated')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{new Date(device.createdAt).toLocaleDateString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Relay control */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Relay Control</CardTitle>
            {!device.isOnline && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ background: 'color-mix(in oklch, var(--brand-red) 12%, transparent)', color: 'var(--brand-red)' }}>
                Offline — control disabled
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: RELAY_COUNT }, (_, i) => {
              const isOn = relayStates[i]
              const isSending = relaySending[i]
              const isAnimating = relayAnimating[i]
              return (
                <div
                  key={i}
                  className={[
                    'relative flex flex-col gap-3 rounded-xl border-2 p-4 transition-all overflow-hidden',
                    isOn
                      ? 'border-green-500 bg-green-50'
                      : 'border-border bg-card hover:border-muted-foreground/30',
                    isAnimating ? 'relay-card-on-enter' : '',
                    !device.isOnline ? 'opacity-50' : '',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${isOn ? 'text-green-700' : 'text-muted-foreground'}`}>
                      Relay {i + 1}
                    </span>
                    <span
                      className={[
                        'w-2.5 h-2.5 rounded-full transition-all',
                        isOn
                          ? 'bg-green-500'
                          : 'bg-muted-foreground/25',
                        isAnimating ? 'relay-led-blink' : '',
                      ].join(' ')}
                      style={isOn ? { boxShadow: '0 0 7px 3px rgba(34,197,94,0.65)' } : {}}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-bold ${isOn ? 'text-green-700' : 'text-muted-foreground/60'}`}>
                      {isOn ? 'ON' : 'OFF'}
                    </span>
                    <Switch
                      id={`relay-${i + 1}`}
                      checked={isOn}
                      disabled={isSending || !device.isOnline}
                      onCheckedChange={(checked) => handleRelayToggle(i, checked)}
                      className={isSending ? 'opacity-50' : ''}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Datastreams — solo admin e installer */}
      {canSeeDatastreams && template && template.datastreams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('devices.detail.datastreamTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">{t('devices.detail.dsColKey')}</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">{t('devices.detail.dsColName')}</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">{t('devices.detail.dsColType')}</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">{t('devices.detail.dsColUnit')}</th>
                  </tr>
                </thead>
                <tbody>
                  {template.datastreams.map((ds) => (
                    <tr key={ds.key} className="border-t">
                      <td className="px-4 py-2 font-mono text-xs">{ds.key}</td>
                      <td className="px-4 py-2">{ds.name}</td>
                      <td className="px-4 py-2 text-muted-foreground">{ds.type}</td>
                      <td className="px-4 py-2 text-muted-foreground">{ds.unit ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      {device.metadata && Object.keys(device.metadata).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('devices.detail.metadataTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted rounded-md px-4 py-3 text-xs font-mono overflow-auto">
              {JSON.stringify(device.metadata, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Provisioning modal */}
      <ProvisioningModal
        deviceId={device.id}
        deviceName={device.name}
        open={provisioningOpen}
        onClose={() => setProvisioningOpen(false)}
      />
    </div>
  )
}
