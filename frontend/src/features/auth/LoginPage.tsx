import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from './authStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Cpu, AlertCircle, Wifi, Activity, Shield, ArrowRight } from 'lucide-react'

export function LoginPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      navigate('/app/dashboards', { replace: true })
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t('auth.invalidCredentials')
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">

      {/* ── Left panel ── */}
      <div
        className="hidden lg:flex lg:w-[58%] flex-col justify-between p-14 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #01295F 0%, #01295F 50%, #0a3d6b 75%, #0f4f82 100%)',
        }}
      >
        {/* Grid pattern — más visible */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
          }}
        />

        {/* Nodos del circuito — SVG decorativo */}
        <svg
          className="absolute inset-0 w-full h-full opacity-10"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Líneas de circuito */}
          <line x1="15%" y1="20%" x2="40%" y2="20%" stroke="#FFB30F" strokeWidth="1.5" />
          <line x1="40%" y1="20%" x2="40%" y2="45%" stroke="#FFB30F" strokeWidth="1.5" />
          <line x1="40%" y1="45%" x2="70%" y2="45%" stroke="#437F97" strokeWidth="1.5" />
          <line x1="70%" y1="45%" x2="70%" y2="70%" stroke="#437F97" strokeWidth="1.5" />
          <line x1="70%" y1="70%" x2="90%" y2="70%" stroke="#FFB30F" strokeWidth="1.5" />
          <line x1="20%" y1="60%" x2="20%" y2="80%" stroke="#437F97" strokeWidth="1.5" />
          <line x1="20%" y1="80%" x2="55%" y2="80%" stroke="#437F97" strokeWidth="1.5" />
          <line x1="10%" y1="40%" x2="25%" y2="40%" stroke="#FFB30F" strokeWidth="1.5" />
          {/* Nodos */}
          <circle cx="15%" cy="20%" r="4" fill="#FFB30F" />
          <circle cx="40%" cy="20%" r="4" fill="#FFB30F" />
          <circle cx="40%" cy="45%" r="4" fill="#437F97" />
          <circle cx="70%" cy="45%" r="4" fill="#437F97" />
          <circle cx="70%" cy="70%" r="4" fill="#FFB30F" />
          <circle cx="90%" cy="70%" r="4" fill="#FFB30F" />
          <circle cx="20%" cy="60%" r="4" fill="#437F97" />
          <circle cx="20%" cy="80%" r="4" fill="#437F97" />
          <circle cx="55%" cy="80%" r="4" fill="#437F97" />
          <circle cx="10%" cy="40%" r="4" fill="#FFB30F" />
          <circle cx="25%" cy="40%" r="4" fill="#FFB30F" />
          {/* Nodos grandes vacíos */}
          <circle cx="40%" cy="20%" r="10" fill="none" stroke="#FFB30F" strokeWidth="1" opacity="0.5" />
          <circle cx="70%" cy="45%" r="10" fill="none" stroke="#437F97" strokeWidth="1" opacity="0.5" />
          <circle cx="20%" cy="80%" r="10" fill="none" stroke="#437F97" strokeWidth="1" opacity="0.5" />
        </svg>

        {/* Glow top-right */}
        <div
          className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-20 blur-[100px] pointer-events-none"
          style={{ background: 'var(--brand-cerulean)' }}
        />
        {/* Glow bottom-left */}
        <div
          className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-15 blur-[80px] pointer-events-none"
          style={{ background: 'var(--brand-amber)' }}
        />

        {/* Logo */}
        <div className="relative flex items-center gap-3 z-10">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: 'var(--brand-amber)' }}
          >
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-xl font-bold tracking-tight">IoTech</span>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-10">
          <div className="space-y-5">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border"
              style={{ borderColor: 'rgba(255,179,15,0.4)', color: 'var(--brand-amber)', background: 'rgba(255,179,15,0.1)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              Platform v2.0 — Now live
            </div>
            <h1 className="text-5xl font-extrabold text-white leading-[1.1] tracking-tight">
              Smart control<br />
              for{' '}
              <span
                className="relative inline-block"
                style={{ color: 'var(--brand-amber)' }}
              >
                connected
                <svg className="absolute -bottom-1 left-0 w-full" height="4" viewBox="0 0 200 4">
                  <path d="M0 2 Q100 0 200 2" stroke="#FFB30F" strokeWidth="2" fill="none" opacity="0.6" />
                </svg>
              </span>
              <br />devices
            </h1>
            <p className="text-white/55 text-base max-w-xs leading-relaxed">
              Monitor, manage and automate your IoT infrastructure from a single platform.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-col gap-2.5">
            {[
              { icon: Wifi,     label: 'Real-time device monitoring' },
              { icon: Activity, label: 'Live relay & sensor control' },
              { icon: Shield,   label: 'Role-based access control' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors"
                style={{
                  borderColor: 'rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.05)',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(255,179,15,0.15)' }}
                >
                  <Icon className="w-4 h-4" style={{ color: 'var(--brand-amber)' }} />
                </div>
                <span className="text-white/75 text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-white/25 text-xs">© 2025 IoTech. All rights reserved.</p>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden"
        style={{ background: 'white' }}
      >
        {/* Mobile-only background — mismo tratamiento que el panel izquierdo */}
        <div
          className="lg:hidden absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, #01295F 0%, #01295F 50%, #0a3d6b 75%, #0f4f82 100%)',
          }}
        />
        <div
          className="lg:hidden absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
          }}
        />
        <div
          className="lg:hidden absolute top-0 right-0 w-72 h-72 rounded-full opacity-20 blur-[80px] pointer-events-none"
          style={{ background: 'var(--brand-cerulean)' }}
        />
        <div
          className="lg:hidden absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-15 blur-[70px] pointer-events-none"
          style={{ background: 'var(--brand-amber)' }}
        />

        {/* Mobile logo */}
        <div className="relative z-10 flex lg:hidden items-center gap-2.5 mb-8">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: 'var(--brand-amber)' }}
          >
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">IoTech</span>
        </div>

        <div className="relative z-10 w-full max-w-[380px] space-y-6">

          {/* Heading — blanco en mobile, imperial en desktop */}
          <div className="space-y-1.5">
            <h2 className="text-3xl font-bold lg:text-foreground text-white"
                style={{ color: undefined }}>
              <span className="hidden lg:inline" style={{ color: 'var(--brand-imperial)' }}>Welcome back</span>
              <span className="lg:hidden text-white">Welcome back</span>
            </h2>
            <p className="text-sm lg:text-muted-foreground text-white/60">{t('auth.subtitle')}</p>
          </div>

          {/* Form card — glassmorphism en mobile, borde simple en desktop */}
          <div
            className="rounded-2xl p-8 space-y-5 lg:border lg:shadow-sm lg:bg-white"
            style={{
              background: 'rgba(255,255,255,0.07)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-semibold lg:text-foreground text-white/90">
                {t('auth.emailLabel')}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder={t('auth.emailPlaceholder')}
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 lg:bg-gray-50/80 bg-white/10 lg:text-foreground text-white lg:placeholder:text-muted-foreground placeholder:text-white/40 lg:border-border border-white/20 focus-visible:ring-[#437F97]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-semibold lg:text-foreground text-white/90">
                {t('auth.passwordLabel')}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 lg:bg-gray-50/80 bg-white/10 lg:text-foreground text-white lg:placeholder:text-muted-foreground placeholder:text-white/40 lg:border-border border-white/20 focus-visible:ring-[#437F97]"
              />
            </div>

            {error && (
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
                style={{ background: '#fee2e2', color: '#b91c1c' }}
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              onClick={handleSubmit}
              className="w-full h-11 font-semibold text-sm gap-2 group"
              disabled={loading}
              style={{ background: 'var(--brand-imperial)' }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  {t('auth.signingIn')}
                </span>
              ) : (
                <>
                  {t('auth.signIn')}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
