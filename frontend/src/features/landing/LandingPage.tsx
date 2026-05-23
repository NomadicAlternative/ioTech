import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Cpu, Wifi, LayoutDashboard, Zap, ArrowRight, CheckCircle2, ChevronDown, Cable, Thermometer, Bell, Globe, BarChart3 } from 'lucide-react'
import logo from '@/assets/logoprincipal.JPG'

const LANGS = [
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'es', label: 'ES', flag: '🇪🇸' },
  { code: 'de', label: 'DE', flag: '🇩🇪' },
  { code: 'pt', label: 'PT', flag: '🇧🇷' },
  { code: 'fr', label: 'FR', flag: '🇫🇷' },
  { code: 'it', label: 'IT', flag: '🇮🇹' },
]

function scrollTo(id: string) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }

export function LandingPage() {
  const { t, i18n } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [langOpen, setLangOpen] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    let animId: number
    const p: { x: number; y: number; vx: number; vy: number }[] = []
    for (let i = 0; i < 40; i++) p.push({ x: Math.random() * window.innerWidth, y: Math.random() * 400, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3 })
    function draw() {
      canvas.width = window.innerWidth; canvas.height = 400
      for (const pt of p) {
        pt.x += pt.vx; pt.y += pt.vy
        if (pt.x < 0 || pt.x > canvas.width) pt.vx *= -1
        if (pt.y < 0 || pt.y > canvas.height) pt.vy *= -1
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 0.8, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(252,163,17,0.25)'; ctx.fill()
      }
      for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) {
        const dx = p[i].x - p[j].x, dy = p[i].y - p[j].y, d = Math.sqrt(dx * dx + dy * dy)
        if (d < 100) { ctx.beginPath(); ctx.moveTo(p[i].x, p[i].y); ctx.lineTo(p[j].x, p[j].y); ctx.strokeStyle = `rgba(252,163,17,${0.06 - d * 0.0006})`; ctx.stroke() }
      }
      animId = requestAnimationFrame(draw)
    }
    draw(); return () => cancelAnimationFrame(animId)
  }, [])

  const flow = [ { icon: Cpu, tkey: 'flow1' }, { icon: Wifi, tkey: 'flow2' }, { icon: LayoutDashboard, tkey: 'flow3' } ]
  const feats = [ { icon: Cable, tkey: 'f1' }, { icon: Zap, tkey: 'f2' }, { icon: Thermometer, tkey: 'f3' }, { icon: Bell, tkey: 'f4' }, { icon: Globe, tkey: 'f5' }, { icon: BarChart3, tkey: 'f6' } ]

  return (
    <div className="min-h-screen bg-[var(--prussian-blue)] text-white overflow-x-hidden">
      <nav className="fixed top-0 w-full z-50 bg-[var(--prussian-blue)]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <img src={logo} alt="ioTech" style={{ height: '210px' }} className="w-auto" />
          <div className="hidden md:flex items-center gap-8 text-sm text-[var(--muted-blue)]">
            <button onClick={() => scrollTo('features')} className="hover:text-white transition-colors">{t('landing.nav.features')}</button>
            <button onClick={() => scrollTo('flow')} className="hover:text-white transition-colors">{t('landing.nav.how')}</button>
            <button onClick={() => scrollTo('pricing')} className="hover:text-white transition-colors">{t('landing.nav.pricing')}</button>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button onClick={() => setLangOpen(!langOpen)} className="flex items-center gap-1 text-sm text-[var(--muted-blue)] hover:text-white px-2 py-1 rounded-lg hover:bg-white/5">
                <Globe className="h-3.5 w-3.5"/>
                {LANGS.find(l => l.code === (i18n.language?.split('-')[0] || 'en'))?.flag}
                {LANGS.find(l => l.code === (i18n.language?.split('-')[0] || 'en'))?.label || 'EN'}
                <ChevronDown className="h-3 w-3"/>
              </button>
              {langOpen && <div className="absolute top-full right-0 mt-1 bg-[#1A2F52] border border-white/10 rounded-xl p-1 shadow-xl z-50">
                {LANGS.map(l => (
                  <button key={l.code} onClick={() => { i18n.changeLanguage(l.code); setLangOpen(false) }}
                    className={`flex items-center gap-2 w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      (i18n.language?.split('-')[0] || 'en') === l.code ? 'bg-[var(--orange)]/20 text-[var(--orange)]' : 'text-[var(--muted-blue)] hover:text-white'
                    }`}>
                    <span>{l.flag}</span>
                    <span>{l.label}</span>
                  </button>
                ))}
              </div>}
            </div>
            <a href="/login" className="text-sm text-[var(--muted-blue)] hover:text-white">{t('landing.nav.login')}</a>
            <a href="/register" className="text-xs bg-[var(--orange)] text-black font-medium px-3 py-1.5 rounded-full hover:bg-amber-400 transition-all hover:scale-105">{t('landing.nav.start')}</a>
          </div>
        </div>
      </nav>

      <section className="relative pt-32 pb-4 md:pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="/hero-bg.png" alt="" className="w-full h-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--prussian-blue)]/20 via-transparent to-[var(--prussian-blue)]" />
        </div>
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-[400px] opacity-40 pointer-events-none z-10"/>
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-[var(--brand-green)] bg-teal-500/10 border border-teal-500/20 px-3 py-1 rounded-full mb-4 md:mb-8"><Zap className="h-3 w-3"/>{t('landing.hero.badge')}</div>
          <h1 className="text-2xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">{t('landing.hero.title1')} <span className="bg-gradient-to-r from-[var(--brand-green)] to-[var(--orange)] bg-clip-text text-transparent">{t('landing.hero.title2')}</span></h1>
          <p className="text-sm md:text-lg text-[var(--muted-blue)] mt-6 max-w-2xl mx-auto leading-relaxed">{t('landing.hero.subtitle')}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
            <a href="/register" className="inline-flex items-center gap-2 bg-[var(--orange)] text-black font-semibold px-4 py-2 md:px-8 md:py-4 rounded-full text-sm md:text-lg hover:bg-amber-400 transition-all hover:scale-105 shadow-lg shadow-amber-500/20">{t('landing.hero.cta')} <ArrowRight className="h-4 w-4 md:h-5 md:w-5"/></a>
            <button onClick={()=>scrollTo('flow')} className="inline-flex items-center gap-2 border border-white/10 text-white font-medium px-4 py-2 md:px-8 md:py-4 rounded-full text-sm md:text-lg hover:bg-white/5 transition-all">{t('landing.hero.demo')} <ChevronDown className="h-4 w-4 md:h-5 md:w-5"/></button>
          </div>
        </div>
      </section>

      <section id="flow" className="pt-0 md:pt-24 pb-12 md:pb-24 px-6 bg-gradient-to-b from-transparent to-[#0D1A30]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-xl md:text-3xl font-bold text-center mb-4">{t('landing.flow.title')}</h2>
          <p className="text-sm md:text-base text-[var(--muted-blue)] text-center max-w-xl mx-auto mb-6 md:mb-16">{t('landing.flow.subtitle')}</p>
          <div className="grid md:grid-cols-3 gap-6 md:gap-8 mb-6 md:mb-16">
             {flow.map(({icon:I,tkey:k},i)=>(<div key={k} className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-4 md:p-8 hover:bg-white/[0.04] hover:border-[var(--brand-green)]/30 transition-all duration-300 overflow-hidden">
               <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[var(--brand-green)]/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
               <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[var(--brand-green)]/30 group-hover:bg-[var(--brand-green)]/80 transition-colors duration-500" style={{ animation: `flowPulse 2s ease-in-out ${i * 0.6}s infinite` }} />
               <div className="w-8 h-8 md:w-12 md:h-12 rounded-xl bg-[var(--brand-green)]/10 flex items-center justify-center mb-3 md:mb-6"><I className="h-4 w-4 md:h-6 md:w-6 text-[var(--brand-green)]"/></div><h3 className="text-sm md:text-xl font-semibold mb-1.5 md:mb-3">{t(`landing.${k}.title`)}</h3><p className="text-xs md:text-base text-[var(--muted-blue)] leading-relaxed">{t(`landing.${k}.desc`)}</p></div>))}
          </div>
          <div className="rounded-2xl border border-white/5 overflow-hidden shadow-2xl shadow-black/30">
            <img src="/dashboard-preview.png" alt="Dashboard preview" className="w-full" />
          </div>
        </div>
      </section>

      <section id="features" className="py-8 md:py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-xl md:text-3xl font-bold text-center mb-4">{t('landing.features.title')}</h2>
          <p className="text-sm md:text-base text-[var(--muted-blue)] text-center max-w-xl mx-auto mb-6 md:mb-16">{t('landing.features.subtitle')}</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
             {feats.map(({icon:I,tkey:k},i)=>(<div key={k} className="group relative flex gap-3 md:gap-4 rounded-xl border border-white/5 bg-white/[0.01] p-3 md:p-6 hover:border-[var(--brand-green)]/20 transition-all overflow-hidden">
               <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[var(--brand-green)]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
               <div className="w-7 h-7 md:w-10 md:h-10 rounded-lg bg-[var(--brand-green)]/10 flex items-center justify-center shrink-0 mt-0.5"><I className="h-3.5 w-3.5 md:h-5 md:w-5 text-[var(--brand-green)]"/></div><div><h3 className="text-sm md:text-base font-semibold mb-0.5 md:mb-1">{t(`landing.${k}.title`)}</h3><p className="text-[11px] md:text-sm text-[var(--muted-blue)] leading-relaxed">{t(`landing.${k}.desc`)}</p></div></div>))}
          </div>
        </div>
      </section>

      <section className="py-8 md:py-24 px-6 bg-gradient-to-b from-[#0D1A30] to-transparent">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full mb-4 md:mb-8">✨ {t('landing.ai.badge')}</div>
          <h2 className="text-xl md:text-3xl font-bold mb-6">{t('landing.ai.title1')} <span className="bg-gradient-to-r from-[var(--brand-green)] to-[var(--orange)] bg-clip-text text-transparent">{t('landing.ai.title2')}</span></h2>
          <div className="group relative rounded-2xl border border-[var(--brand-green)]/10 bg-black/20 p-4 md:p-8 max-w-2xl mx-auto overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--brand-green)]/40 to-transparent" />
            <div className="flex gap-3 text-left">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0 mt-1"><span className="text-xs">🤖</span></div>
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted-blue)]">"{t('landing.ai_demo.prompt')}"</p>
                <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-green-400 text-sm"><CheckCircle2 className="h-4 w-4"/>{t('landing.ai_demo.response1')}</div>
                  <p className="text-xs text-green-400/70 pl-6">{t('landing.ai_demo.response2')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-8 md:py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-xl md:text-3xl font-bold mb-4">{t('landing.pricing.title')}</h2>
          <p className="text-sm md:text-base text-[var(--muted-blue)] max-w-lg mx-auto mb-6 md:mb-12">{t('landing.pricing.subtitle')}</p>
          <div className="group relative max-w-md mx-auto rounded-2xl border border-[var(--brand-green)]/10 bg-white/[0.02] p-6 md:p-8 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--brand-green)]/40 to-transparent" />
            <div className="text-2xl md:text-5xl font-bold mb-4">{t('landing.pricing.price')}<span className="text-xs md:text-lg text-[var(--muted-blue)] font-normal">{t('landing.pricing.period')}</span></div>
            <p className="text-xs md:text-base text-[var(--muted-blue)] mb-6">{t('landing.pricing.note')}</p>
            <ul className="space-y-2 md:space-y-3 text-left mb-6">
              {['Dispositivos ilimitados','Clientes ilimitados','Asistente IA','Dashboard profesional','OTA updates','Reglas automáticas','Soporte prioritario'].map(f=>(<li key={f} className="flex items-center gap-2 text-[11px] md:text-sm"><CheckCircle2 className="h-3.5 w-3.5 md:h-4 md:w-4 text-green-400 shrink-0"/><span className="text-[var(--muted-blue)]">{f}</span></li>))}
            </ul>
            <a href="/register" className="block w-full text-center bg-[var(--orange)] text-black font-semibold px-4 py-2 md:px-8 md:py-4 rounded-full text-sm md:text-lg hover:bg-amber-400 transition-all hover:scale-105">{t('landing.pricing.cta')}</a>
          </div>
        </div>
      </section>

      <footer className="py-12 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <img src={logo} alt="ioTech" style={{ height: '150px' }} className="w-auto" />
          <p className="text-sm text-[var(--muted-blue)]">{t('landing.footer')}</p>
        </div>
      </footer>
    </div>
  )
}
