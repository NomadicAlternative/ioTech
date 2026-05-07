import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Cable, AlertTriangle, Cpu, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { listDevices } from '@/features/devices/api'
import type { Device } from '@/features/widgets/types'
import { ProvisioningModal } from '@/features/devices/components/ProvisioningModal'

// ─── Browser compatibility check ─────────────────────────────────────────────

function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProvisioningPage() {
  const { t } = useTranslation()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const supported = isWebSerialSupported()

  async function loadDevices() {
    setLoading(true)
    setError(null)
    try {
      const res = await listDevices(1, 100, undefined, 'unclaimed')
      setDevices(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load devices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDevices()
  }, [])

  function handleProvision(device: Device) {
    setSelectedDevice(device)
    setModalOpen(true)
  }

  function handleModalClose() {
    setModalOpen(false)
    setSelectedDevice(null)
    // Refresh list after provisioning attempt
    loadDevices()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">
            {t('provisioning.title', 'Provision Devices')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('provisioning.subtitle', 'Connect unclaimed devices via USB Serial')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadDevices} disabled={loading}>
          <RefreshCw className="w-4 h-4 mr-2" />
          {t('common.refresh', 'Refresh')}
        </Button>
      </div>

      {/* Browser warning */}
      {!supported && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-900 dark:text-amber-100">
                {t('provisioning.browserUnsupported', 'Browser not supported')}
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                {t(
                  'provisioning.browserUnsupportedDesc',
                  'Web Serial API is only available in Chrome and Edge. Please use one of these browsers to provision devices via USB.'
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Device list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 border rounded-lg animate-pulse">
              <div className="h-10 w-10 rounded-full bg-muted" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-48 rounded bg-muted" />
                <div className="h-3 w-32 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-center">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={loadDevices}>
            {t('common.retry', 'Retry')}
          </Button>
        </div>
      ) : devices.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <Cpu className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">{t('provisioning.noDevices', 'No unclaimed devices')}</h3>
          <p className="text-muted-foreground mt-1 max-w-sm mx-auto">
            {t(
              'provisioning.noDevicesDesc',
              'Create a device first to get a claim token, then connect it via USB to provision it.'
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map((device) => (
            <div
              key={device.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">{device.name || device.id.slice(0, 8)}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-xs">
                      {device.hardwareId || '—'}
                    </Badge>
                    <Badge variant={device.status === 'unclaimed' ? 'secondary' : 'default'} className="text-xs">
                      {device.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => handleProvision(device)}
                disabled={!supported || device.status !== 'unclaimed'}
              >
                <Cable className="w-4 h-4 mr-2" />
                {t('provisioning.provisionButton', 'Provision via USB')}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {selectedDevice && (
        <ProvisioningModal
          deviceId={selectedDevice.id}
          deviceName={selectedDevice.name || selectedDevice.id.slice(0, 8)}
          open={modalOpen}
          onClose={handleModalClose}
        />
      )}
    </div>
  )
}
