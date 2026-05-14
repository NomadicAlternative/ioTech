import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Wand2, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import api from '@/lib/axios'

export function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [form, setForm] = useState({ name: '', email: '', password: '', contact_email: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) {
      setError(t('register.errors.required', 'All fields are required'))
      return
    }
    if (form.password.length < 8) {
      setError(t('register.errors.passwordLength', 'Password must be at least 8 characters'))
      return
    }
    setLoading(true)
    setError(null)
    try {
      await api.post('/api/auth/installer-register', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        contact_email: form.contact_email.trim() || undefined,
      })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Registration failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="w-full max-w-md mx-4 rounded-2xl bg-[var(--card)] p-8 shadow-sm border border-[var(--border)] text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
          <h2 className="text-xl font-bold">{t('register.success.title', '¡Registro exitoso!')}</h2>
          <p className="text-muted-foreground">
            {t('register.success.message', 'Tu cuenta fue creada. Redirigiendo al login...')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="w-full max-w-md mx-4 rounded-2xl bg-[var(--card)] p-8 shadow-sm border border-[var(--border)]">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
            <Wand2 className="h-6 w-6 text-[var(--accent)]" />
            ioTech
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('register.subtitle', 'Creá tu cuenta de instalador')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">{t('register.companyName', 'Nombre de la empresa')}</Label>
            <Input
              id="name"
              value={form.name}
              onChange={e => update('name', e.target.value)}
              placeholder={t('register.companyPlaceholder', 'Ej: Instalaciones Eléctricas SA')}
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="email">{t('register.email', 'Email')}</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={e => update('email', e.target.value)}
              placeholder="contacto@tuempresa.com"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">{t('register.password', 'Contraseña')}</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={e => update('password', e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="contact_email">{t('register.contactEmail', 'Email de contacto (opcional)')}</Label>
            <Input
              id="contact_email"
              type="email"
              value={form.contact_email}
              onChange={e => update('contact_email', e.target.value)}
              placeholder="info@tuempresa.com"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {loading ? t('register.creating', 'Creando cuenta...') : t('register.submit', 'Crear cuenta')}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {t('register.hasAccount', '¿Ya tenés cuenta?')}{' '}
          <Link to="/login" className="text-[var(--accent)] hover:underline font-medium">
            {t('register.login', 'Ingresá')}
          </Link>
        </p>
      </div>
    </div>
  )
}
