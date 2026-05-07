import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/features/auth/authStore'
import {
  Usb, Wifi, CheckCircle2, AlertTriangle, Loader2,
  Cpu, Download, Zap, ArrowRight, RotateCcw,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────

type Step = 'start' | 'building' | 'flashing' | 'reset' | 'wifi' | 'provision' | 'done' | 'error'

interface Props {
  deviceId: string
  deviceName: string
  open: boolean
  onClose: () => void
}

// ─── Steps definition ──────────────────────────────────────────────────────

interface StepDef {
  key: Step
  icon: typeof Cpu
  title: string
  desc: string
}

const STEPS: StepDef[] = [
  { key: 'start', icon: Cpu, title: 'Connect ESP32', desc: 'Connect the ESP32 to a USB port on this computer' },
  { key: 'building', icon: Download, title: 'Building firmware', desc: 'Compiling the latest firmware...' },
  { key: 'flashing', icon: Zap, title: 'Flashing', desc: 'Writing firmware to ESP32...' },
  { key: 'reset', icon: RotateCcw, title: 'Reset device', desc: 'Press the EN/RESET button on the ESP32' },
  { key: 'wifi', icon: Wifi, title: 'WiFi Setup', desc: 'Enter the WiFi credentials for the device' },
  { key: 'provision', icon: Usb, title: 'Serial Setup', desc: 'Sending configuration via USB...' },
  { key: 'done', icon: CheckCircle2, title: 'Complete!', desc: 'Device is configured and connected' },
]

// ─── Component ─────────────────────────────────────────────────────────────

export function FlashDeviceWizard({ deviceId, deviceName, open, onClose }: Props) {
  const { t } = useTranslation()
  const token = useAuthStore((s) => s.accessToken)
  const [step, setStep] = useState<Step>('start')
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [wifiSsid, setWifiSsid] = useState('')
  const [wifiPassword, setWifiPassword] = useState('')
  const [credentials, setCredentials] = useState<Record<string, unknown> | null>(null)
  const logsRef = useRef<HTMLDivElement>(null)

  // Auto-scroll logs
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight
    }
  }, [logs])

  function reset() {
    setStep('start')
    setLogs([])
    setError(null)
    setWifiSsid('')
    setWifiPassword('')
    setCredentials(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  // ── SSE Flash via fetch stream ────────────────────────────────────────

  async function startFlash() {
    setStep('building')
    setLogs([])
    setError(null)

    try {
      const res = await fetch(`/api/devices/${deviceId}/flash`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
        },
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: 'Flash request failed' } }))
        throw new Error(err.error?.message || 'Flash request failed')
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7).trim()
            continue
          }
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              handleSSEEvent(data)
            } catch {
              // skip malformed
            }
          }
        }
      }
    } catch (err) {
      setStep('error')
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  function handleSSEEvent(data: Record<string, unknown>) {
    if (data.step && data.line) {
      setLogs((prev) => [...prev, `[${data.step}] ${data.line}`])

      // Auto-advance step based on content
      if (data.line?.includes('Flash complete!') || data.line?.includes('rebooting')) {
        setStep('reset')
      }
      if (data.line?.includes('Building firmware') || data.step === 'build') {
        setStep('building')
      }
      if (data.step === 'flash') {
        setStep('flashing')
      }
    }

    if (data.error || data.message?.includes('failed')) {
      setStep('error')
      setError(data.error || data.message)
    }

    if (data.credentials) {
      setCredentials(data.credentials)
      setStep('wifi')
    }
  }

  function handleWifiSubmit() {
    if (!wifiSsid.trim()) return
    setStep('provision')
  }

  // ── Render helpers ─────────────────────────────────────────────────────

  const currentStepIdx = STEPS.findIndex((s) => s.key === step)

  function StepIcon({ def, active, done }: { def: StepDef; active: boolean; done: boolean }) {
    if (done) return <CheckCircle2 className="w-5 h-5 text-green-500" />
    if (active) return <def.icon className="w-5 h-5 text-primary animate-pulse" />
    return <def.icon className="w-5 h-5 text-muted-foreground/40" />
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Flash & Provision: {deviceName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* ── Stepper ─────────────────────────────────────────────────── */}
          <div className="flex items-center gap-1">
            {STEPS.slice(0, 5).map((s, i) => (
              <div key={s.key} className="flex items-center gap-1 flex-1">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-colors ${
                    i < currentStepIdx
                      ? 'bg-green-500 text-white'
                      : i === currentStepIdx
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                  }`}
                  title={s.title}
                >
                  {i < currentStepIdx ? '✓' : i + 1}
                </div>
                {i < 4 && (
                  <div
                    className={`flex-1 h-0.5 ${
                      i < currentStepIdx ? 'bg-green-500' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* ── Step content ────────────────────────────────────────────── */}
          <div className="min-h-[200px]">
            {/* Start */}
            {step === 'start' && (
              <div className="text-center space-y-4 py-8">
                <Cpu className="w-16 h-16 text-muted-foreground mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold">{t('flash.step1Title', 'Connect the ESP32')}</h3>
                  <p className="text-muted-foreground mt-1 max-w-md mx-auto">
                    {t('flash.step1Desc', 'Plug the ESP32 into a USB port on this computer. Make sure the cable supports data transfer.')}
                  </p>
                </div>
                <Button size="lg" onClick={startFlash} className="gap-2">
                  <Zap className="w-4 h-4" />
                  {t('flash.startButton', 'Start Flash')}
                </Button>
              </div>
            )}

            {/* Building / Flashing */}
            {(step === 'building' || step === 'flashing') && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  <div>
                    <p className="font-medium">
                      {step === 'building'
                        ? t('flash.building', 'Building firmware...')
                        : t('flash.flashing', 'Flashing ESP32...')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {step === 'building'
                        ? t('flash.buildingDesc', 'Compiling the latest firmware version')
                        : t('flash.flashingDesc', 'Writing firmware to device memory')}
                    </p>
                  </div>
                </div>
                <div
                  ref={logsRef}
                  className="bg-black text-green-400 rounded-lg p-3 h-40 overflow-y-auto font-mono text-xs space-y-0.5"
                >
                  {logs.length === 0 && (
                    <p className="text-green-600 animate-pulse">Waiting for output...</p>
                  )}
                  {logs.map((log, i) => (
                    <p key={i} className="whitespace-pre-wrap break-all">{log}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Reset */}
            {step === 'reset' && (
              <div className="text-center space-y-4 py-8">
                <RotateCcw className="w-16 h-16 text-amber-500 mx-auto animate-spin" />
                <div>
                  <h3 className="text-lg font-semibold">{t('flash.resetTitle', 'Press EN/RESET')}</h3>
                  <p className="text-muted-foreground mt-1 max-w-md mx-auto">
                    {t('flash.resetDesc', 'Press the EN or RESET button on the ESP32 board. This reboots the device so it can receive the configuration via USB.')}
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    ⚠️ {t('flash.resetHint', 'Do this NOW — the device only waits ~10 seconds for configuration.')}
                  </p>
                </div>
                <Button size="lg" onClick={() => setStep('wifi')} className="gap-2">
                  <ArrowRight className="w-4 h-4" />
                  {t('flash.continueButton', 'Done, continue')}
                </Button>
              </div>
            )}

            {/* WiFi form */}
            {step === 'wifi' && (
              <div className="space-y-4 py-4">
                <Wifi className="w-12 h-12 text-primary mx-auto" />
                <h3 className="text-lg font-semibold text-center">{t('flash.wifiTitle', 'WiFi Credentials')}</h3>
                <p className="text-muted-foreground text-center text-sm">
                  {t('flash.wifiDesc', 'Enter the WiFi network the ESP32 should connect to.')}
                </p>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>{t('flash.ssidLabel', 'Network name (SSID)')}</Label>
                    <Input
                      value={wifiSsid}
                      onChange={(e) => setWifiSsid(e.target.value)}
                      placeholder="MyWiFiNetwork"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('flash.passwordLabel', 'Password')}</Label>
                    <Input
                      type="password"
                      value={wifiPassword}
                      onChange={(e) => setWifiPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <Button
                  className="w-full gap-2"
                  size="lg"
                  onClick={handleWifiSubmit}
                  disabled={!wifiSsid.trim()}
                >
                  <Usb className="w-4 h-4" />
                  {t('flash.connectSerialButton', 'Connect via USB Serial')}
                </Button>
              </div>
            )}

            {/* Provision — Web Serial flow */}
            {step === 'provision' && (
              <div className="text-center space-y-4 py-8">
                <Loader2 className="w-16 h-16 text-primary mx-auto animate-spin" />
                <div>
                  <h3 className="text-lg font-semibold">{t('flash.provisioning', 'Sending configuration...')}</h3>
                  <p className="text-muted-foreground mt-1">
                    {t('flash.provisioningDesc', 'Select the serial port and click Connect. The configuration will be sent to the ESP32.')}
                  </p>
                </div>
                {credentials && (
                  <div className="bg-muted rounded-lg p-3 text-left text-xs font-mono space-y-1">
                    <p>device_token: {String(credentials.device_token).slice(0, 12)}...</p>
                    <p>tenant_id: {String(credentials.tenant_id)}</p>
                    <p>device_id: {String(credentials.device_id).slice(0, 12)}...</p>
                  </div>
                )}
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    ⚠️ {t('flash.serialHint', 'Web Serial API requires Chrome or Edge. Select the port that matches your ESP32.')}
                  </p>
                </div>
              </div>
            )}

            {/* Done */}
            {step === 'done' && (
              <div className="text-center space-y-4 py-8">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold">{t('flash.doneTitle', 'Device Configured!')}</h3>
                  <p className="text-muted-foreground mt-1 max-w-md mx-auto">
                    {t('flash.doneDesc', 'The ESP32 is now connected to WiFi and MQTT. It will appear online in your device list shortly.')}
                  </p>
                </div>
                <Button onClick={handleClose} className="gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {t('common.done', 'Done')}
                </Button>
              </div>
            )}

            {/* Error */}
            {step === 'error' && (
              <div className="text-center space-y-4 py-8">
                <AlertTriangle className="w-16 h-16 text-destructive mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold">{t('flash.errorTitle', 'Something went wrong')}</h3>
                  <p className="text-destructive mt-1">{error}</p>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={() => setStep('start')}>
                    {t('common.retry', 'Retry')}
                  </Button>
                  <Button variant="outline" onClick={handleClose}>
                    {t('common.cancel', 'Cancel')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
