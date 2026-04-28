import { useState } from 'react'
import { Usb, Wifi, CheckCircle2, AlertTriangle, Loader2, Copy, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getProvisioningCredentials } from '../api'
import type { ProvisioningCredentials } from '../api'

// ─── Browser compatibility check ─────────────────────────────────────────────

function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator
}

// ─── Steps ────────────────────────────────────────────────────────────────────

type Step = 'browser-check' | 'wifi-form' | 'connecting' | 'sending' | 'done' | 'error'

interface Props {
  deviceId: string
  deviceName: string
  open: boolean
  onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProvisioningModal({ deviceId, deviceName, open, onClose }: Props) {
  const [step, setStep] = useState<Step>('browser-check')
  const [wifiSsid, setWifiSsid] = useState('')
  const [wifiPassword, setWifiPassword] = useState('')
  const [credentials, setCredentials] = useState<ProvisioningCredentials | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const supported = isWebSerialSupported()

  function handleOpen(isOpen: boolean) {
    if (!isOpen) {
      onClose()
      // Reset after close animation
      setTimeout(reset, 300)
    }
  }

  function reset() {
    setStep('browser-check')
    setWifiSsid('')
    setWifiPassword('')
    setCredentials(null)
    setErrorMsg(null)
    setCopied(null)
  }

  function handleStart() {
    if (!supported) return
    setStep('wifi-form')
  }

  async function handleConnect() {
    if (!wifiSsid.trim()) return
    setStep('connecting')
    setErrorMsg(null)

    try {
      const creds = await getProvisioningCredentials(deviceId)
      setCredentials(creds)
      setStep('sending')
      await sendViaSerial(creds)
      setStep('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setStep('error')
    }
  }

  async function sendViaSerial(creds: ProvisioningCredentials) {
    // Web Serial: request port → open → write JSON → close
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serial = (navigator as any).serial
    const port = await serial.requestPort()
    await port.open({ baudRate: 115200 })

    const payload = JSON.stringify({
      wifi_ssid: wifiSsid,
      wifi_password: wifiPassword,
      backend_url: creds.backend_url,
      mqtt_url: creds.mqtt_url,
      device_token: creds.device_token,
    })

    const writer = port.writable.getWriter()
    const encoded = new TextEncoder().encode(payload + '\n')
    await writer.write(encoded)
    writer.releaseLock()
    await port.close()
  }

  async function handleCopy(text: string, key: string) {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Usb className="h-5 w-5 text-primary" />
            Configurar dispositivo
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {deviceName}
          </DialogDescription>
        </DialogHeader>

        {/* ── Step: browser check ── */}
        {step === 'browser-check' && (
          <div className="space-y-4 py-2">
            {supported ? (
              <>
                <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-800">Navegador compatible</p>
                    <p className="text-xs text-green-700 mt-0.5">
                      Tu navegador soporta Web Serial API. Conectá el ESP32 por USB antes de continuar.
                    </p>
                  </div>
                </div>
                <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>Conectá el ESP32 al puerto USB de tu computadora</li>
                  <li>Ingresá las credenciales WiFi del cliente</li>
                  <li>El dashboard enviará la configuración automáticamente</li>
                  <li>El dispositivo se reiniciará y estará online en segundos</li>
                </ol>
                <Button className="w-full" onClick={handleStart}>
                  Continuar
                </Button>
              </>
            ) : (
              <>
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Navegador no compatible</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Web Serial API requiere Chrome o Edge. Safari y Firefox no están soportados.
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Abrí esta página en <strong>Google Chrome</strong> o <strong>Microsoft Edge</strong> para usar el provisioning USB.
                </p>
                <Button variant="outline" className="w-full" onClick={onClose}>
                  Cerrar
                </Button>
              </>
            )}
          </div>
        )}

        {/* ── Step: wifi form ── */}
        {step === 'wifi-form' && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wifi className="h-4 w-4" />
              <span>Credenciales WiFi del cliente</span>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="wifi-ssid">Nombre de red (SSID)</Label>
                <Input
                  id="wifi-ssid"
                  value={wifiSsid}
                  onChange={(e) => setWifiSsid(e.target.value)}
                  placeholder="MiRedWiFi"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="wifi-password">Contraseña</Label>
                <Input
                  id="wifi-password"
                  type="password"
                  value={wifiPassword}
                  onChange={(e) => setWifiPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep('browser-check')}>
                Atrás
              </Button>
              <Button
                className="flex-1"
                disabled={!wifiSsid.trim()}
                onClick={handleConnect}
              >
                Enviar al dispositivo
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: connecting / sending ── */}
        {(step === 'connecting' || step === 'sending') && (
          <div className="py-8 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <div className="text-center">
              <p className="text-sm font-medium">
                {step === 'connecting' ? 'Obteniendo credenciales…' : 'Enviando configuración al dispositivo…'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {step === 'sending' && 'Seleccioná el puerto serial del ESP32 en el diálogo del navegador'}
              </p>
            </div>
          </div>
        )}

        {/* ── Step: done ── */}
        {step === 'done' && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800">¡Configuración enviada!</p>
                <p className="text-xs text-green-700 mt-0.5">
                  El ESP32 se reiniciará y conectará a la red. En unos segundos debería aparecer online en el dashboard.
                </p>
              </div>
            </div>
            <Button className="w-full" onClick={() => { onClose(); reset() }}>
              Listo
            </Button>
          </div>
        )}

        {/* ── Step: error ── */}
        {step === 'error' && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">Error al configurar</p>
                <p className="text-xs text-destructive/80 mt-0.5">{errorMsg}</p>
              </div>
            </div>

            {/* Fallback: mostrar credenciales para configuración manual */}
            {credentials && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Credenciales para configuración manual
                </p>
                {[
                  { label: 'WiFi SSID', value: wifiSsid, key: 'ssid' },
                  { label: 'WiFi Password', value: wifiPassword, key: 'pass' },
                  { label: 'Backend URL', value: credentials.backend_url, key: 'backend' },
                  { label: 'MQTT URL', value: credentials.mqtt_url, key: 'mqtt' },
                  { label: 'Device Token', value: credentials.device_token, key: 'token' },
                ].map(({ label, value, key }) => (
                  <div key={key} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-mono text-xs truncate">{value}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => handleCopy(value, key)}
                    >
                      {copied === key ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep('wifi-form')}>
                Reintentar
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => { onClose(); reset() }}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
