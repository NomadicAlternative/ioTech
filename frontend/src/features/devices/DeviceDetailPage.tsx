import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Wifi, WifiOff, Clock, Usb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useDeviceStore } from './deviceStore'
import { fetchDeviceTemplate, sendDeviceCommand } from './api'
import type { DeviceTemplate } from '@/features/widgets/types'
import { ProvisioningModal } from './components/ProvisioningModal'

const RELAY_COUNT = 7

export function DeviceDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentDevice, fetchDevice, clearCurrent } = useDeviceStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [template, setTemplate] = useState<DeviceTemplate | null>(null)
  const [provisioningOpen, setProvisioningOpen] = useState(false)

  // relay states: index 0 = relay 1, ..., index 6 = relay 7
  const [relayStates, setRelayStates] = useState<boolean[]>(Array(RELAY_COUNT).fill(false))
  const [relaySending, setRelaySending] = useState<boolean[]>(Array(RELAY_COUNT).fill(false))

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetchDevice(id)
      .catch((err) =>
        setError(err instanceof Error ? err.message : t('devices.detail.errorLoad'))
      )
      .finally(() => setLoading(false))

    return () => { clearCurrent() }
  }, [id, fetchDevice, clearCurrent])

  useEffect(() => {
    if (!currentDevice?.templateId) return
    fetchDeviceTemplate(currentDevice.templateId)
      .then(setTemplate)
      .catch(() => {/* template optional */})
  }, [currentDevice?.templateId])

  async function handleRelayToggle(relayIndex: number, newState: boolean) {
    if (!id) return
    const relayNum = relayIndex + 1

    setRelaySending((prev) => { const s = [...prev]; s[relayIndex] = true; return s })
    try {
      await sendDeviceCommand(id, relayNum, newState ? 'on' : 'off')
      setRelayStates((prev) => { const s = [...prev]; s[relayIndex] = newState; return s })
    } catch {
      // revert on error — state stays the same
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
          {device.isOnline ? (
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 flex items-center gap-1">
              <Wifi className="h-3 w-3" />
              {t('devices.status.online')}
            </Badge>
          ) : (
            <Badge variant="secondary" className="flex items-center gap-1">
              <WifiOff className="h-3 w-3" />
              {t('devices.status.offline')}
            </Badge>
          )}
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
        <CardHeader>
          <CardTitle className="text-base">Relay Control</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: RELAY_COUNT }, (_, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <Label htmlFor={`relay-${i + 1}`} className="font-medium">
                  Relay {i + 1}
                </Label>
                <Switch
                  id={`relay-${i + 1}`}
                  checked={relayStates[i]}
                  disabled={relaySending[i] || !device.isOnline}
                  onCheckedChange={(checked) => handleRelayToggle(i, checked)}
                />
              </div>
            ))}
          </div>
          {!device.isOnline && (
            <p className="text-xs text-muted-foreground mt-3">
              Device is offline — relay control disabled.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Datastreams */}
      {template && template.datastreams.length > 0 && (
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
