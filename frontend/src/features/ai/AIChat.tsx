import { useState, useEffect } from 'react'
import { Wand2, Loader2, CheckCircle2, Copy, Cpu, Cable, AlertTriangle, Rocket, ChevronDown, ChevronRight, Wifi, Thermometer, Zap, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/axios'

interface AIConfig {
  template: { name: string; description: string }
  drivers: { model: string; gpio?: number; i2c_addr?: string; channels?: { num: number; gpio: number; name: string }[] }[]
  datastreams: { key: string; name: string; type: string; unit?: string; direction: string }[]
  rules: {
    name: string
    description: string
    condition: { datastream: string; operator: string; value: number }
    actions: { type: string; relay: number; state: string }[]
  }[]
  diagrama: string
  _source?: string
}

export function AIChat() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AIConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [appliedData, setAppliedData] = useState<{ deviceId?: string; claimToken?: string } | null>(null)
  const [catalog, setCatalog] = useState<Record<string, { model: string; description: string; note?: string; protocol?: string }[]> | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    sensors: true, actuators: true, displays: false, connectivity: false, boards: false,
  })

  useEffect(() => {
    api.get('/api/ai/catalog').then(r => setCatalog(r.data.data)).catch(() => {})
  }, [])

    async function handleSubmit() {
    if (!input.trim() || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    setApplied(false)
    setAppliedData(null)
    try {
      const res = await api.post('/api/ai/configure', { prompt: input.trim() })
      setResult(res.data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar configuración')
    } finally {
      setLoading(false)
    }
  }

  async function handleApply() {
    if (!result || applying) return
    setApplying(true)
    setError(null)
    try {
      const res = await api.post('/api/ai/apply', { config: result })
      const data = res.data.data
      setApplied(true)
      setAppliedData({ deviceId: data.device?.id, claimToken: data.claim_token })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al aplicar configuración')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="flex gap-6 max-w-6xl mx-auto">
      {/* ── Sidebar: Component Catalog ──────────────────────────────────── */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-10'} shrink-0 transition-all duration-200`}>
        <div className="sticky top-4 space-y-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {sidebarOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {sidebarOpen && 'Componentes'}
          </button>

          {sidebarOpen && catalog && (
            <div className="space-y-2">
              {[
                { key: 'boards',       icon: Cpu,         label: 'Boards',      color: 'text-[var(--blue)]' },
                { key: 'connectivity', icon: Wifi,       label: 'Conectividad', color: 'text-[var(--accent)]' },
                { key: 'sensors',      icon: Thermometer, label: 'Sensores',    color: 'text-green-600' },
                { key: 'actuators',    icon: Zap,         label: 'Actuadores',  color: 'text-amber-600' },
                { key: 'displays',     icon: Monitor,     label: 'Displays',    color: 'text-purple-600' },
              ].map(({ key, icon: Icon, label, color }) => {
                const items = catalog[key]
                if (!items || items.length === 0) return null
                const expanded = expandedSections[key]
                return (
                  <div key={key}>
                    <button
                      onClick={() => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))}
                      className="w-full flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground py-1"
                    >
                      {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      <Icon className={`h-3.5 w-3.5 ${color}`} />
                      {label}
                      <Badge variant="secondary" className="ml-auto text-[10px] px-1 py-0 h-4">{items.length}</Badge>
                    </button>
                    {expanded && (
                      <div className="ml-4 space-y-0.5">
                        {items.map((item: any) => (
                          <div
                            key={item.model}
                            className="rounded-md px-2 py-1 text-xs cursor-pointer hover:bg-[var(--muted)] transition-colors group"
                            onClick={() => setInput(prev => prev ? `${prev}, ${item.model}` : item.model)}
                          >
                            <p className="font-medium text-foreground">{item.model}</p>
                            <p className="text-[11px] text-muted-foreground leading-tight">{item.description}</p>
                            {(item.protocol || item.note) && (
                              <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                {item.protocol || item.note}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Main: Chat ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Wand2 className="h-6 w-6 text-[var(--accent)]" />
          Asistente IA
        </h1>
        <p className="text-muted-foreground mt-1">
          Describí tu dispositivo y la IA genera la configuración automáticamente
        </p>
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder='Ej: "Tengo un ESP32 con DHT22, cuando 12°C activar relay 1 y apagar relay 3"'
          className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
        />
        <Button onClick={handleSubmit} disabled={loading || !input.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {loading ? 'Generando…' : 'Generar'}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Template */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-semibold">Template: {result.template.name}</span>
                </div>
                <Badge variant="secondary">{result.datastreams.length} datastream{result.datastreams.length !== 1 ? 's' : ''}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{result.template.description}</p>
            </CardContent>
          </Card>

          {/* Drivers / Pines */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Cable className="h-4 w-4" />
                Drivers activos ({result.drivers?.length || 0})
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {result.drivers?.map((driver, i) => (
                  <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2">
                    <p className="text-sm font-medium">{driver.model}</p>
                    {driver.gpio != null && <p className="text-xs text-muted-foreground">GPIO {driver.gpio}</p>}
                    {driver.i2c_addr && <p className="text-xs text-muted-foreground">I2C {driver.i2c_addr}</p>}
                    {driver.channels?.map((ch, j) => (
                      <p key={j} className="text-xs text-muted-foreground">
                        {ch.name} — GPIO {ch.gpio}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Rules */}
          {result.rules?.length > 0 && (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <h3 className="font-medium flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  Reglas ({result.rules.length})
                </h3>
                {result.rules.map((rule, i) => (
                  <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2">
                    <p className="text-sm font-medium">{rule.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{rule.description}</p>
                    <p className="text-xs mt-1">
                      <code className="bg-[var(--muted)] px-1 rounded">
                        {rule.condition.datastream} {rule.condition.operator} {rule.condition.value}
                      </code>
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {rule.actions.map((a, j) => (
                        <Badge key={j} variant="outline" className="text-xs">
                          relay{a.relay} {a.state === 'on' ? 'ON' : 'OFF'}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Diagrama */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Diagrama de conexión</h3>
                <Button variant="ghost" size="icon-sm" onClick={() => navigator.clipboard.writeText(result.diagrama)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <pre className="text-xs bg-[var(--muted)]/50 rounded-lg p-3 overflow-x-auto whitespace-pre">
                {result.diagrama}
              </pre>
            </CardContent>
          </Card>

          {/* Apply button */}
          {!applied ? (
            <Button className="w-full" onClick={handleApply} disabled={applying}>
              {applying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Rocket className="h-4 w-4 mr-2" />}
              {applying ? 'Aplicando…' : 'Aplicar configuración'}
            </Button>
          ) : (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800">¡Configuración aplicada!</span>
              </div>
              <p className="text-sm text-green-700">Template, dispositivo y reglas creados.</p>
              {appliedData?.deviceId && (
                <p className="text-xs text-green-600">
                  Ya podés flashear y provisionar el dispositivo.
                  <Button variant="link" size="sm" className="h-auto p-0 ml-1 text-green-700 underline"
                    onClick={() => window.open(`/app/devices/${appliedData.deviceId}`, '_blank')}>
                    Ver dispositivo →
                  </Button>
                </p>
              )}
            </div>
          )}

          {result._source && (
            <p className="text-xs text-muted-foreground text-right">
              Generado por: {result._source === 'ai' ? '🤖 DeepSeek' : '📋 Motor de reglas'}
            </p>
          )}
        </div>
      )}
      </div>
    </div>
  )
}
