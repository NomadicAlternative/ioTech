import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>('browser-check')
  const [wifiSsid, setWifiSsid] = useState('')
  const [wifiPassword, setWifiPassword] = useState('')
  const [credentials, setCredentials] = useState<ProvisioningCredentials | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [portSelected, setPortSelected] = useState(false)

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
    setPortSelected(false)
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serial = (navigator as any).serial
    const port = await serial.requestPort()
    setPortSelected(true)

    const payload = JSON.stringify({
      wifi_ssid: wifiSsid,
      wifi_password: wifiPassword,
      backend_url: creds.backend_url,
      mqtt_url: creds.mqtt_url,
      device_token: creds.device_token,
      tenant_id: creds.tenant_id,
      device_id: creds.device_id,
    }) + '\n'

    const encoded = new TextEncoder().encode(payload)

    const SEND_DURATION_MS = 8000
    const SEND_INTERVAL_MS = 300
    const RECONNECT_DELAY_MS = 1200
    const deadline = Date.now() + SEND_DURATION_MS

    // Open port (may need to reopen after EN/RESET)
    async function openPort() {
      if (port.readable || port.writable) {
        try { await port.close() } catch { /* already closed */ }
      }
      await port.open({ baudRate: 115200 })
    }

    await openPort()

    while (Date.now() < deadline) {
      try {
        const writer = port.writable.getWriter()
        await writer.write(encoded)
        writer.releaseLock()
      } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        const isDeviceLost = msg.includes('device has been lost') || msg.includes('disconnected')
        if (isDeviceLost) {
          // EN/RESET pressed — wait for device to re-enumerate, then reconnect
          await new Promise(r => setTimeout(r, RECONNECT_DELAY_MS))
          try { await openPort() } catch { /* still reconnecting */ }
        } else {
          throw err
        }
      }
      await new Promise(r => setTimeout(r, SEND_INTERVAL_MS))
    }

    try { await port.close() } catch { /* ignore */ }
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
            {t('devices.provisioning.title')}
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
                    <p className="text-sm font-medium text-green-800">{t('devices.provisioning.browserOk')}</p>
                    <p className="text-xs text-green-700 mt-0.5">{t('devices.provisioning.browserOkDesc')}</p>
                  </div>
                </div>
                <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>{t('devices.provisioning.step1')}</li>
                  <li>{t('devices.provisioning.step2')}</li>
                  <li>{t('devices.provisioning.step3')}</li>
                  <li className="font-semibold text-foreground">{t('devices.provisioning.step4')}</li>
                </ol>
                <Button className="w-full" onClick={handleStart}>
                  {t('devices.provisioning.btnContinue')}
                </Button>
              </>
            ) : (
              <>
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">{t('devices.provisioning.browserFail')}</p>
                    <p className="text-xs text-amber-700 mt-0.5">{t('devices.provisioning.browserFailDesc')}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{t('devices.provisioning.browserFailHint')}</p>
                <Button variant="outline" className="w-full" onClick={onClose}>
                  {t('devices.provisioning.btnClose')}
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
              <span>{t('devices.provisioning.wifiTitle')}</span>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="wifi-ssid">{t('devices.provisioning.ssidLabel')}</Label>
                <Input
                  id="wifi-ssid"
                  value={wifiSsid}
                  onChange={(e) => setWifiSsid(e.target.value)}
                  placeholder={t('devices.provisioning.ssidPlaceholder')}
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="wifi-password">{t('devices.provisioning.passwordLabel')}</Label>
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
                {t('devices.provisioning.btnBack')}
              </Button>
              <Button className="flex-1" disabled={!wifiSsid.trim()} onClick={handleConnect}>
                {t('devices.provisioning.btnSend')}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: connecting / sending ── */}
        {(step === 'connecting' || step === 'sending') && (
          <div className="py-6 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <div className="text-center space-y-3">
              <p className="text-sm font-medium">
                {step === 'connecting' ? t('devices.provisioning.connecting') : t('devices.provisioning.sending')}
              </p>
              {step === 'sending' && !portSelected && (
                <p className="text-sm text-muted-foreground">
                  {t('devices.provisioning.selectPort')}
                </p>
              )}
              {step === 'sending' && portSelected && (
                <div className="rounded-lg bg-amber-50 border-2 border-amber-400 px-4 py-3 flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <p className="text-sm font-bold text-amber-800">
                    {t('devices.provisioning.resetAlert')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step: done ── */}
        {step === 'done' && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800">{t('devices.provisioning.doneTitle')}</p>
                <p className="text-xs text-green-700 mt-0.5">{t('devices.provisioning.doneDesc')}</p>
              </div>
            </div>
            <Button className="w-full" onClick={() => { onClose(); reset() }}>
              {t('devices.provisioning.btnDone')}
            </Button>
          </div>
        )}

        {/* ── Step: error ── */}
        {step === 'error' && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">{t('devices.provisioning.errorTitle')}</p>
                <p className="text-xs text-destructive/80 mt-0.5">{errorMsg}</p>
              </div>
            </div>

            {credentials && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  {t('devices.provisioning.manualTitle')}
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
                {t('devices.provisioning.btnRetry')}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => { onClose(); reset() }}>
                {t('devices.provisioning.btnClose')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
