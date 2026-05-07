import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/features/auth/authStore'
import { ProvisioningModal } from './ProvisioningModal'
import {
  CheckCircle2, AlertTriangle, Loader2,
  Cpu, Zap, RotateCcw,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'building' | 'flashing' | 'done' | 'error'

interface Props {
  deviceId: string
  deviceName: string
  open: boolean
  onClose: () => void
}

// ─── Component ─────────────────────────────────────────────────────────────

export function FlashDeviceWizard({ deviceId, deviceName, open, onClose }: Props) {
  const { t } = useTranslation()
  const token = useAuthStore((s) => s.accessToken)
  const [phase, setPhase] = useState<Phase>('idle')
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showProvisioning, setShowProvisioning] = useState(false)
  const logsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight
    }
  }, [logs])

  function reset() {
    setPhase('idle')
    setLogs([])
    setError(null)
    setShowProvisioning(false)
  }

  function handleClose() {
    if (phase === 'building' || phase === 'flashing') return // don't close during flash
    reset()
    onClose()
  }

  // ── Start flash ────────────────────────────────────────────────────────

  async function startFlash() {
    setPhase('building')
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
        throw new Error(err.error?.message || `HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse complete SSE events from buffer
        while (buffer.includes('\n\n')) {
          const idx = buffer.indexOf('\n\n')
          const eventBlock = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)

          let eventType = 'message'
          let eventData = ''

          for (const line of eventBlock.split('\n')) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim()
            } else if (line.startsWith('data: ')) {
              eventData = line.slice(6)
            }
          }

          if (!eventData) continue

          try {
            const data = JSON.parse(eventData)

            if (eventType === 'progress') {
              if (data.line) {
                setLogs((prev) => [...prev, data.line])
              }
              if (data.step === 'flash') {
                setPhase('flashing')
              }
            } else if (eventType === 'done') {
              setPhase('done')
              setLogs((prev) => [...prev, '✅ Flash complete! Device is ready.'])
            } else if (eventType === 'error') {
              throw new Error(data.message || 'Flash failed')
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
              throw parseErr
            }
          }
        }
      }

      // If we got here without explicit done event, check if flash completed
      if (phase !== 'done' && phase !== 'error') {
        setPhase('done')
      }
    } catch (err) {
      setPhase('error')
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <Dialog open={open && !showProvisioning} onOpenChange={(o) => { if (!o) handleClose() }}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Flash Device: {deviceName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2 min-h-[250px]">
            {/* Idle — start screen */}
            {phase === 'idle' && (
              <div className="text-center space-y-6 py-8">
                <Cpu className="w-20 h-20 text-muted-foreground mx-auto" />
                <div>
                  <h3 className="text-xl font-bold">{t('flash.ready', 'Ready to Flash')}</h3>
                  <div className="mt-4 space-y-2 text-left max-w-md mx-auto text-sm text-muted-foreground">
                    <p>1. 🔌 {t('flash.instruction1', 'Connect the ESP32 via USB')}</p>
                    <p>2. ⚡ {t('flash.instruction2', 'Click Start Flash — the wizard compiles and uploads firmware')}</p>
                    <p>3. 🔄 {t('flash.instruction3', 'Press EN/RESET on the ESP32 when prompted')}</p>
                    <p>4. 📡 {t('flash.instruction4', 'Enter WiFi credentials so the device can connect')}</p>
                  </div>
                </div>
                <Button size="lg" onClick={startFlash} className="gap-2">
                  <Zap className="w-4 h-4" />
                  {t('flash.start', 'Start Flash')}
                </Button>
              </div>
            )}

            {/* Building / Flashing */}
            {(phase === 'building' || phase === 'flashing') && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
                  <div>
                    <p className="font-semibold">
                      {phase === 'building'
                        ? t('flash.building', 'Building firmware...')
                        : t('flash.flashing', 'Flashing ESP32...')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('flash.pleaseWait', 'Please wait — do not disconnect the device')}
                    </p>
                  </div>
                </div>

                <div
                  ref={logsRef}
                  className="bg-gray-950 text-green-400 rounded-lg p-3 h-48 overflow-y-auto font-mono text-xs"
                >
                  {logs.length === 0 && (
                    <p className="text-green-600 animate-pulse">Starting...</p>
                  )}
                  {logs.map((log, i) => (
                    <p key={i} className="whitespace-pre-wrap break-all leading-relaxed">
                      {log.startsWith('⚠') ? (
                        <span className="text-yellow-400">{log}</span>
                      ) : log.startsWith('✅') ? (
                        <span className="text-green-300">{log}</span>
                      ) : log.startsWith('❌') ? (
                        <span className="text-red-400">{log}</span>
                      ) : (
                        <span className="text-green-500/80">{log}</span>
                      )}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Done — show instructions + open provisioning */}
            {phase === 'done' && (
              <div className="text-center space-y-6 py-4">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
                <div>
                  <h3 className="text-xl font-bold text-green-700 dark:text-green-400">
                    {t('flash.flashComplete', 'Flash Complete!')}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-sm">
                    {t('flash.flashCompleteDesc', 'Firmware successfully uploaded to ESP32.')}
                  </p>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-lg p-4 text-left">
                  <div className="flex items-start gap-3">
                    <RotateCcw className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-sm text-amber-800 dark:text-amber-200">
                      <p className="font-semibold mb-1">{t('flash.pressReset', '⚠️ Press EN/RESET on the ESP32 NOW')}</p>
                      <p>{t('flash.pressResetDesc', 'The device reboots and waits ~10 seconds to receive configuration via USB. Do this BEFORE clicking Continue.')}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={handleClose}>
                    {t('common.cancel', 'Cancel')}
                  </Button>
                  <Button size="lg" className="gap-2" onClick={() => setShowProvisioning(true)}>
                    <CheckCircle2 className="w-4 h-4" />
                    {t('flash.continueToProvision', 'Continue — Configure WiFi')}
                  </Button>
                </div>
              </div>
            )}

            {/* Error */}
            {phase === 'error' && (
              <div className="text-center space-y-4 py-8">
                <AlertTriangle className="w-16 h-16 text-destructive mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold">{t('flash.error', 'Flash Failed')}</h3>
                  <p className="text-destructive text-sm mt-1">{error}</p>
                  {logs.length > 0 && (
                    <div className="bg-gray-950 text-red-400 rounded-lg p-3 h-32 overflow-y-auto font-mono text-xs mt-3 text-left">
                      {logs.slice(-20).map((log, i) => (
                        <p key={i} className="whitespace-pre-wrap break-all">{log}</p>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => startFlash()}>{t('common.retry', 'Retry')}</Button>
                  <Button variant="outline" onClick={handleClose}>{t('common.cancel', 'Cancel')}</Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Provisioning modal — opens after flash is done */}
      <ProvisioningModal
        deviceId={deviceId}
        deviceName={deviceName}
        open={showProvisioning}
        onClose={() => {
          setShowProvisioning(false)
          handleClose()
        }}
      />
    </>
  )
}
