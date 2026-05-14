import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Cpu, Wifi, LayoutDashboard, Zap, Shield, Users, 
  ArrowRight, CheckCircle2, ChevronDown, Cable, Thermometer,
  Bell, Globe, BarChart3
} from 'lucide-react'

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

export function LandingPage() {
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let animId: number

    const particles: { x: number; y: number; vx: number; vy: number; r: number; alpha: number }[] = []
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * (canvas.width = window.innerWidth),
        y: Math.random() * (canvas.height = 400),
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.4 + 0.1,
      })
    }

    function draw() {
      canvas.width = window.innerWidth
      canvas.height = 400
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(252, 163, 17, ${p.alpha})` // orange particles
        ctx.fill()
      }
      // connecting lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 100) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(252, 163, 17, ${0.06 - dist * 0.0006})`
            ctx.stroke()
          }
        }
      }
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <div className="min-h-screen bg-[var(--prussian-blue)] text-white overflow-x-hidden">
      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 bg-[var(--prussian-blue)]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight">
            <span className="text-white">io</span><span className="text-[var(--orange)]">Tech</span>
          </span>
          <div className="hidden md:flex items-center gap-8 text-sm text-[var(--muted-blue)]">
            <button onClick={() => scrollTo('features')} className="hover:text-white transition-colors">Features</button>
            <button onClick={() => scrollTo('flow')} className="hover:text-white transition-colors">Cómo funciona</button>
            <button onClick={() => scrollTo('pricing')} className="hover:text-white transition-colors">Precios</button>
          </div>
          <div className="flex items-center gap-3">
            <a href="/login" className="text-sm text-[var(--muted-blue)] hover:text-white transition-colors">Login</a>
            <a href="/register"
              className="text-sm bg-[var(--orange)] text-black font-medium px-4 py-2 rounded-full hover:bg-amber-400 transition-all hover:scale-105">
              Empezar gratis
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-[400px] opacity-40 pointer-events-none" />
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-[var(--orange)] bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full mb-8">
            <Zap className="h-3 w-3" />
            Plataforma IoT para instaladores profesionales
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight">
            Tus dispositivos IoT{' '}
            <span className="bg-gradient-to-r from-[var(--orange)] to-amber-300 bg-clip-text text-transparent">
              sin código
            </span>
          </h1>
          <p className="text-lg md:text-xl text-[var(--muted-blue)] mt-6 max-w-2xl mx-auto leading-relaxed">
            Conectá sensores, relays y actuadores. La IA configura todo. 
            Vos solo describí lo que necesitás y vendé soluciones IoT a tus clientes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
            <a href="/register"
              className="inline-flex items-center gap-2 bg-[var(--orange)] text-black font-semibold px-8 py-4 rounded-full text-lg hover:bg-amber-400 transition-all hover:scale-105 shadow-lg shadow-amber-500/20">
              Comenzar ahora <ArrowRight className="h-5 w-5" />
            </a>
            <button onClick={() => scrollTo('flow')}
              className="inline-flex items-center gap-2 border border-white/10 text-white font-medium px-8 py-4 rounded-full text-lg hover:bg-white/5 transition-all">
              Ver demo <ChevronDown className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Flow Diagram ────────────────────────────────────────────────── */}
      <section id="flow" className="py-24 px-6 bg-gradient-to-b from-transparent to-[#0D1A30]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            ¿Cómo funciona?
          </h2>
          <p className="text-[var(--muted-blue)] text-center max-w-xl mx-auto mb-16">
            Tres pasos. Sin código. Sin configuraciones complicadas.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Cpu, title: '1. Conectá', desc: 'Conectá sensores y actuadores a un ESP32. La IA detecta el hardware y genera la configuración.' },
              { icon: Wifi, title: '2. Flasheá', desc: 'Con un click, el firmware se carga en el ESP32 por USB. El dispositivo se conecta a internet.' },
              { icon: LayoutDashboard, title: '3. Controlá', desc: 'Dashboard en tiempo real con temperatura, relays, reglas automáticas. Todo desde el navegador.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title}
                className="relative group rounded-2xl border border-white/5 bg-white/[0.02] p-8 hover:bg-white/[0.04] hover:border-[var(--orange)]/20 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-[var(--orange)]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Icon className="h-6 w-6 text-[var(--orange)]" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{title}</h3>
                <p className="text-[var(--muted-blue)] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Todo lo que necesitás
          </h2>
          <p className="text-[var(--muted-blue)] text-center max-w-xl mx-auto mb-16">
            Una plataforma, infinitas posibilidades. Desde domótica hasta agricultura inteligente.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Cable, title: '11 sensores soportados', desc: 'DHT22, BME280, PIR, HC-SR04, DS18B20 y más.' },
              { icon: Zap, title: 'Actuadores', desc: 'Relays, servos, LEDs RGB, buzzers, bombas de agua.' },
              { icon: Thermometer, title: 'Reglas automáticas', desc: '"Si temperatura > 30°C, activar ventilación".' },
              { icon: Bell, title: 'Alertas en tiempo real', desc: 'Notificaciones cuando algo sale de rango.' },
              { icon: Globe, title: 'OTA updates', desc: 'Actualizá el firmware de todos tus dispositivos por WiFi.' },
              { icon: BarChart3, title: 'Dashboard profesional', desc: 'Gráficos, gauges, switches. Todo arrastrable.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title}
                className="flex gap-4 rounded-xl border border-white/5 bg-white/[0.01] p-6 hover:border-[var(--orange)]/10 transition-all">
                <div className="w-10 h-10 rounded-lg bg-[var(--orange)]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="h-5 w-5 text-[var(--orange)]" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{title}</h3>
                  <p className="text-sm text-[var(--muted-blue)] leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── IA Assistant ─────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-gradient-to-b from-[#0D1A30] to-transparent">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full mb-8">
            ✨ Asistente IA
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Describí tu proyecto.{' '}
            <span className="bg-gradient-to-r from-purple-400 to-[var(--orange)] bg-clip-text text-transparent">
              La IA lo construye.
            </span>
          </h2>
          <div className="rounded-2xl border border-white/5 bg-black/20 p-6 md:p-8 max-w-2xl mx-auto">
            <div className="flex gap-3 text-left">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0 mt-1">
                <span className="text-xs">🤖</span>
              </div>
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted-blue)]">
                  "Tengo un ESP32 con sensor DHT22, un módulo de 7 relays, y quiero que cuando 
                  la temperatura supere los 30°C se active el relay de ventilación."
                </p>
                <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    Template creado: "Control Térmico 7CH"
                  </div>
                  <p className="text-xs text-green-400/70 pl-6">
                    GPIO14 → DHT22 · GPIO23 → Relay 1 · Regla: temp ≥ 30°C → relay 1 ON
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing / CTA ────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Empezá hoy, gratis
          </h2>
          <p className="text-[var(--muted-blue)] max-w-lg mx-auto mb-12">
            Creá tu cuenta de instalador. Sin tarjeta de crédito. Sin límites en features.
          </p>
          
          <div className="max-w-md mx-auto rounded-2xl border border-[var(--orange)]/20 bg-white/[0.02] p-8">
            <div className="text-5xl font-bold mb-4">$0<span className="text-lg text-[var(--muted-blue)] font-normal">/mes</span></div>
            <p className="text-[var(--muted-blue)] mb-8">Durante el beta. Precios por dispositivo después.</p>
            <ul className="space-y-3 text-left mb-8">
              {['Dispositivos ilimitados', 'Clientes ilimitados', 'Asistente IA', 'Dashboard profesional',
                'OTA updates', 'Reglas automáticas', 'Soporte prioritario'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                  <span className="text-[var(--muted-blue)]">{f}</span>
                </li>
              ))}
            </ul>
            <a href="/register"
              className="block w-full text-center bg-[var(--orange)] text-black font-semibold px-8 py-4 rounded-full text-lg hover:bg-amber-400 transition-all hover:scale-105">
              Crear cuenta gratis
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="py-12 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="text-xl font-bold">
            <span className="text-white">io</span><span className="text-[var(--orange)]">Tech</span>
          </span>
          <p className="text-sm text-[var(--muted-blue)]">
            © 2026 ioTech — Plataforma IoT para instaladores profesionales.
          </p>
        </div>
      </footer>
    </div>
  )
}
