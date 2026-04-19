import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, Wifi, WifiOff, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDeviceStore } from './deviceStore'
import { fetchDeviceTemplate, sendDeviceCommand } from './api'
import type { DeviceTemplate } from '@/features/widgets/types'

export function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentDevice, fetchDevice, clearCurrent } = useDeviceStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [template, setTemplate] = useState<DeviceTemplate | null>(null)

  // ── Command state ──
  const [commandAction, setCommandAction] = useState('')
  const [commandPayload, setCommandPayload] = useState('')
  const [commandPayloadError, setCommandPayloadError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [commandSuccess, setCommandSuccess] = useState(false)
  const [commandError, setCommandError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetchDevice(id)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Error al cargar dispositivo')
      )
      .finally(() => setLoading(false))

    return () => {
      clearCurrent()
    }
  }, [id, fetchDevice, clearCurrent])

  // Fetch template once we have the device
  useEffect(() => {
    if (!currentDevice?.templateId) return
    fetchDeviceTemplate(currentDevice.templateId)
      .then(setTemplate)
      .catch(() => {/* template optional */})
  }, [currentDevice?.templateId])

  async function handleSendCommand() {
    if (!id || !commandAction.trim()) return

    let parsedPayload: unknown = undefined
    if (commandPayload.trim()) {
      try {
        parsedPayload = JSON.parse(commandPayload)
      } catch {
        setCommandPayloadError('JSON inválido')
        return
      }
    }

    setSending(true)
    setCommandError(null)
    setCommandSuccess(false)
    try {
      await sendDeviceCommand(id, commandAction.trim(), parsedPayload)
      setCommandSuccess(true)
      setCommandAction('')
      setCommandPayload('')
    } catch (err) {
      setCommandError(err instanceof Error ? err.message : 'Error al enviar comando')
    } finally {
      setSending(false)
    }
  }

  // ── Loading skeleton ──
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
          Volver
        </Button>
        <div className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm">
          {error ?? 'Dispositivo no encontrado'}
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
          Dispositivos
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{device.name}</h1>
          {device.isOnline ? (
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 flex items-center gap-1">
              <Wifi className="h-3 w-3" />
              En línea
            </Badge>
          ) : (
            <Badge variant="secondary" className="flex items-center gap-1">
              <WifiOff className="h-3 w-3" />
              Desconectado
            </Badge>
          )}
        </div>
        {device.lastSeen && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Última conexión: {new Date(device.lastSeen).toLocaleString('es-AR')}
          </div>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ID</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-sm break-all">{device.id}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Plantilla</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{template?.name ?? device.templateId ?? '—'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Creado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{new Date(device.createdAt).toLocaleDateString('es-AR')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Datastreams */}
      {template && template.datastreams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datastreams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Clave</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Nombre</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Tipo</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Unidad</th>
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
            <CardTitle className="text-base">Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted rounded-md px-4 py-3 text-xs font-mono overflow-auto">
              {JSON.stringify(device.metadata, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Send command */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enviar comando</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {commandSuccess && (
            <div className="rounded-md bg-green-50 text-green-700 px-3 py-2 text-sm">
              Comando enviado con éxito.
            </div>
          )}
          {commandError && (
            <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
              {commandError}
            </div>
          )}
          <div className="space-y-1">
            <Label>Acción *</Label>
            <Input
              value={commandAction}
              onChange={(e) => setCommandAction(e.target.value)}
              placeholder="ej. toggle_led"
            />
          </div>
          <div className="space-y-1">
            <Label>Payload (JSON opcional)</Label>
            <textarea
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono min-h-[60px] focus:outline-none focus:ring-2 focus:ring-ring"
              value={commandPayload}
              onChange={(e) => {
                setCommandPayload(e.target.value)
                setCommandPayloadError(null)
              }}
              placeholder='{"value": true}'
            />
            {commandPayloadError && (
              <p className="text-destructive text-xs">{commandPayloadError}</p>
            )}
          </div>
          <Button
            onClick={handleSendCommand}
            disabled={!commandAction.trim() || sending}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            {sending ? 'Enviando…' : 'Enviar'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
