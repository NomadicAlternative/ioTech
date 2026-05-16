import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyRound, Eye, EyeOff, Check, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import api from '@/lib/axios'

export function SettingsPage() {
  const { t } = useTranslation()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    setSuccess(false)
    try {
      await api.post('/api/auth/change-password', {
        currentPassword,
        newPassword,
      })
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Error al cambiar la contraseña'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'pr-10 bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 focus:border-blue-400 focus:ring-blue-400/20'

  return (
    <div className="max-w-md mx-auto space-y-6 py-4">
      <div className="pb-4 border-b border-[var(--border)]">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-blue-500" />
          {t('settings.title', 'Configuración')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('settings.subtitle', 'Cambiá tu contraseña')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {success && (
          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            <Check className="w-4 h-4 shrink-0" />
            Contraseña cambiada correctamente
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-sm font-medium">Contraseña actual</Label>
          <div className="relative">
            <Input
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Tu contraseña actual"
              className={inputClass}
              autoFocus
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setShowCurrent(!showCurrent)}
              type="button"
            >
              {showCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Nueva contraseña</Label>
          <div className="relative">
            <Input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className={inputClass}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setShowNew(!showNew)}
              type="button"
            >
              {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Confirmar nueva contraseña</Label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repetí la nueva contraseña"
            className={inputClass}
          />
          {confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-red-500">Las contraseñas no coinciden</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full gap-2"
          disabled={!canSubmit || submitting}
        >
          <KeyRound className="w-4 h-4" />
          {submitting ? 'Cambiando...' : 'Cambiar contraseña'}
        </Button>
      </form>
    </div>
  )
}
