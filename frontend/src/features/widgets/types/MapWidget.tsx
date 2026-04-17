import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import { useTelemetryValue } from '@/stores/telemetryStore'
import type { WidgetProps, ConfigFieldsProps } from '../types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function MapWidget({ widgetId, config }: WidgetProps) {
  const latKey = String(config.settings.latDatastreamKey ?? config.datastreamKey ?? '')
  const lngKey = String(config.settings.lngDatastreamKey ?? '')
  const zoom = Number(config.settings.zoom ?? 13)

  const latEntry = useTelemetryValue(config.deviceId ?? '', latKey)
  const lngEntry = useTelemetryValue(config.deviceId ?? '', lngKey)

  const lat = typeof latEntry?.value === 'number' ? latEntry.value : Number(latEntry?.value ?? 0)
  const lng = typeof lngEntry?.value === 'number' ? lngEntry.value : Number(lngEntry?.value ?? 0)

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const markerRef = useRef<import('leaflet').Marker | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    let mounted = true

    const initMap = async () => {
      const L = (await import('leaflet')).default

      // Fix default icon issue with bundlers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      if (!mounted || !containerRef.current) return

      const initialLat = lat || 0
      const initialLng = lng || 0

      const map = L.map(containerRef.current).setView([initialLat, initialLng], zoom)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map)

      const marker = L.marker([initialLat, initialLng]).addTo(map)
      mapRef.current = map
      markerRef.current = marker
    }

    initMap()

    return () => {
      mounted = false
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markerRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetId])

  // Update marker position on lat/lng change
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return
    const pos: [number, number] = [lat || 0, lng || 0]
    markerRef.current.setLatLng(pos)
    mapRef.current.setView(pos, zoom)
  }, [lat, lng, zoom])

  if (!config.deviceId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No device configured
      </div>
    )
  }

  return <div ref={containerRef} className="h-full w-full rounded-sm" style={{ minHeight: 200 }} />
}

export function MapConfigFields({ settings, onChange }: ConfigFieldsProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Latitude datastream key</Label>
        <Input
          value={String(settings.latDatastreamKey ?? '')}
          placeholder="e.g. lat"
          onChange={(e) => onChange({ ...settings, latDatastreamKey: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label>Longitude datastream key</Label>
        <Input
          value={String(settings.lngDatastreamKey ?? '')}
          placeholder="e.g. lng"
          onChange={(e) => onChange({ ...settings, lngDatastreamKey: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label>Zoom level</Label>
        <Input
          type="number"
          value={String(settings.zoom ?? 13)}
          onChange={(e) => onChange({ ...settings, zoom: Number(e.target.value) })}
        />
      </div>
    </div>
  )
}
