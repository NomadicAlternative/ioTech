import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from './authStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import logo from '@/assets/logoprincipal.JPG'
import { Cpu, AlertCircle, Activity, Shield, ArrowRight, Radio, LayoutDashboard, Gauge, ArrowLeft, Check, Mail } from 'lucide-react'
import api from '@/lib/axios'

export function LoginPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotError, setForgotError] = useState<string | null>(null)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setForgotError(null)
    setLoading(true)
    try {
      await api.post('/api/auth/forgot-password', { email: forgotEmail })
      setForgotSent(true)
    } catch {
      setForgotError('Error al enviar. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

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
      <style>{`
        @keyframes flowPulse {
          0%, 100% { left: 0%; opacity: 0.3; }
          50% { left: calc(100% - 8px); opacity: 1; }
        }
      `}</style>

      {/* ── Left panel ── */}
      <div
        className="hidden lg:flex lg:w-[58%] flex-col justify-between p-14 relative overflow-hidden"
        style={{
            background: 'linear-gradient(135deg, #14213D 0%, #1A2F52 50%, #1F3A63 75%, #244878 100%)',
        }}
      >
        {/* Grid pattern — más visible */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(#919EBC15 1px, transparent 1px),
              linear-gradient(90deg, #919EBC15 1px, transparent 1px)
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
          <line x1="15%" y1="20%" x2="40%" y2="20%" stroke="#FCA311" strokeWidth="1.5" />
          <line x1="40%" y1="20%" x2="40%" y2="45%" stroke="#FCA311" strokeWidth="1.5" />
          <line x1="40%" y1="45%" x2="70%" y2="45%" stroke="#14213D" strokeWidth="1.5" />
          <line x1="70%" y1="45%" x2="70%" y2="70%" stroke="#14213D" strokeWidth="1.5" />
          <line x1="70%" y1="70%" x2="90%" y2="70%" stroke="#FCA311" strokeWidth="1.5" />
          <line x1="20%" y1="60%" x2="20%" y2="80%" stroke="#14213D" strokeWidth="1.5" />
          <line x1="20%" y1="80%" x2="55%" y2="80%" stroke="#14213D" strokeWidth="1.5" />
          <line x1="10%" y1="40%" x2="25%" y2="40%" stroke="#FCA311" strokeWidth="1.5" />
          {/* Nodos */}
          <circle cx="15%" cy="20%" r="4" fill="#FCA311" />
          <circle cx="40%" cy="20%" r="4" fill="#FCA311" />
          <circle cx="40%" cy="45%" r="4" fill="#14213D" />
          <circle cx="70%" cy="45%" r="4" fill="#14213D" />
          <circle cx="70%" cy="70%" r="4" fill="#FCA311" />
          <circle cx="90%" cy="70%" r="4" fill="#FCA311" />
          <circle cx="20%" cy="60%" r="4" fill="#14213D" />
          <circle cx="20%" cy="80%" r="4" fill="#14213D" />
          <circle cx="55%" cy="80%" r="4" fill="#14213D" />
          <circle cx="10%" cy="40%" r="4" fill="#FCA311" />
          <circle cx="25%" cy="40%" r="4" fill="#FCA311" />
          {/* Nodos grandes vacíos */}
          <circle cx="40%" cy="20%" r="10" fill="none" stroke="#FCA311" strokeWidth="1" opacity="0.5" />
          <circle cx="70%" cy="45%" r="10" fill="none" stroke="#14213D" strokeWidth="1" opacity="0.5" />
          <circle cx="20%" cy="80%" r="10" fill="none" stroke="#14213D" strokeWidth="1" opacity="0.5" />
        </svg>

        {/* Glow top-right */}
        <div
          className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-20 blur-[100px] pointer-events-none"
          style={{ background: 'var(--brand-cerulean)' }}
        />
        {/* Glow bottom-left */}
        <div
          className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-15 blur-[80px] pointer-events-none"
          style={{ background: 'var(--brand-green)' }}
        />

        {/* Logo */}
        <div className="relative flex flex-col items-center z-10">
          <img src={logo} alt="BeepDash" style={{ height: '420px' }} className="w-auto" />
          
          {/* Animated spark/connection */}
          <div className="relative w-0.5 h-16 my-2">
            <div className="absolute inset-0 bg-gradient-to-b from-[var(--brand-green)] via-[var(--orange)] to-transparent rounded-full" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-[var(--brand-green)] rounded-full animate-ping opacity-40" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--brand-green)] rounded-full animate-pulse shadow-lg shadow-[var(--brand-green)]/60" />
            {/* Traveling dot */}
            <div className="absolute left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full shadow-lg shadow-white/80"
              style={{ animation: 'sparkTravel 1.5s ease-in-out infinite' }} />
            {/* Particles */}
            {[...Array(4)].map((_, i) => (
              <div key={i} className="absolute left-1/2 w-1 h-1 bg-[var(--brand-green)] rounded-full"
                style={{
                  animation: `particleFade ${1 + i * 0.3}s ease-out ${i * 0.4}s infinite`,
                  opacity: 0,
                }} />
            ))}
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border"
              style={{ borderColor: 'rgba(252,163,17,0.4)', color: 'var(--brand-amber)', background: 'rgba(252,163,17,0.1)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              Installer Platform — v2.0
            </div>
            <h1 className="text-4xl font-extrabold text-white leading-[1.15] tracking-tight">
              Deploy, monitor<br />
              and{' '}
                <span className="bg-gradient-to-r from-[var(--brand-green)] to-[var(--orange)] bg-clip-text text-transparent">automate</span>
              <br />your IoT devices
            </h1>
            <p className="text-white/50 text-sm max-w-xs leading-relaxed">
              From ESP32 to dashboard — one platform for the entire device lifecycle.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-col gap-2">
            {[
              { icon: Cpu,    label: 'One-click firmware flash & provisioning' },
              { icon: Radio,  label: 'Real-time MQTT telemetry & commands' },
              { icon: Gauge,  label: 'Custom dashboards with drag & drop widgets' },
              { icon: Shield, label: 'Multi-tenant — one account, many clients' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-colors hover:bg-white/10"
                style={{
                  borderColor: 'rgba(252,163,17,0.15)',
                  background: 'rgba(252,163,17,0.05)',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(252,163,17,0.12)' }}
                >
                  <Icon className="w-4 h-4" style={{ color: 'var(--brand-amber)' }} />
                </div>
                <span className="text-white/70 text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-white/25 text-xs">© 2026 BeepDash Developed by Diego Garcia | Nomadic Alternative</p>
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
          background: 'linear-gradient(135deg, #14213D 0%, #1A2F52 50%, #1F3A63 75%, #244878 100%)',
          }}
        />
        <div
          className="lg:hidden absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(#919EBC15 1px, transparent 1px),
              linear-gradient(90deg, #919EBC15 1px, transparent 1px)
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
          style={{ background: 'var(--brand-green)' }}
        />

        {/* Mobile logo */}
        <div className="relative z-10 flex lg:hidden justify-center mb-8">
          <img src={logo} alt="BeepDash" style={{ height: '420px' }} className="w-auto max-w-full" />
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
                className="h-11 lg:bg-gray-50/80 bg-white/10 lg:text-foreground text-white lg:placeholder:text-muted-foreground placeholder:text-white/40 lg:border-border border-white/20 focus-visible:ring-[#14213D]"
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
                className="h-11 lg:bg-gray-50/80 bg-white/10 lg:text-foreground text-white lg:placeholder:text-muted-foreground placeholder:text-white/40 lg:border-border border-white/20 focus-visible:ring-[#14213D]"
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

              {!forgotMode ? (
                <>
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

                  <div className="text-center">
                    <button
                      type="button"
                      className="text-sm lg:text-muted-foreground text-white/60 hover:underline transition-colors"
                      onClick={() => { setForgotMode(true); setForgotError(null) }}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {forgotSent ? (
                    <div className="text-center space-y-3">
                      <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <Check className="w-5 h-5" />
                        <span className="font-medium">Correo enviado</span>
                      </div>
                      <p className="text-sm lg:text-muted-foreground text-white/60">
                        Si el email está registrado, recibirás una nueva contraseña.
                      </p>
                      <button
                        type="button"
                        className="text-sm lg:text-muted-foreground text-white/60 hover:underline transition-colors"
                        onClick={() => { setForgotMode(false); setForgotSent(false); setForgotEmail('') }}
                      >
                        <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />
                        Volver al inicio de sesión
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="forgot-email" className="text-sm font-semibold lg:text-foreground text-white/90">
                          Email de recuperación
                        </Label>
                        <Input
                          id="forgot-email"
                          type="email"
                          placeholder="tu@email.com"
                          autoComplete="email"
                          required
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          className="h-11 lg:bg-gray-50/80 bg-white/10 lg:text-foreground text-white lg:placeholder:text-muted-foreground placeholder:text-white/40 lg:border-border border-white/20 focus-visible:ring-[#14213D]"
                        />
                      </div>

                      {forgotError && (
                        <div
                          className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
                          style={{ background: '#fee2e2', color: '#b91c1c' }}
                        >
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          {forgotError}
                        </div>
                      )}

                      <Button
                        type="submit"
                        onClick={handleForgotPassword}
                        className="w-full h-11 font-semibold text-sm gap-2"
                        disabled={loading || !forgotEmail}
                        style={{ background: 'var(--brand-imperial)' }}
                      >
                        {loading ? (
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            Enviando...
                          </span>
                        ) : (
                          <>
                            <Mail className="w-4 h-4" />
                            Enviar nueva contraseña
                          </>
                        )}
                      </Button>

                      <div className="text-center">
                        <button
                          type="button"
                          className="text-sm lg:text-muted-foreground text-white/60 hover:underline transition-colors"
                          onClick={() => { setForgotMode(false); setForgotError(null) }}
                        >
                          <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />
                          Volver al inicio de sesión
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
          </div>
        </div>
      </div>
    </div>
  )
}
