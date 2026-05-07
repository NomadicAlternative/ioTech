import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Building2, Copy, Check, KeyRound, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { useAdminStore } from './adminStore'
import { resetPassword } from './adminApi'

export function TenantsPage() {
  const { t } = useTranslation()
  const { tenants, loading, error, fetchTenants, addTenant } = useAdminStore()

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)
  const [credentialOpen, setCredentialOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState<Tenant | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [showResetPw, setShowResetPw] = useState(false)
  const [revealPw, setRevealPw] = useState(false)

  useEffect(() => { fetchTenants() }, [])

  async function handleCreate() {
    if (!name.trim() || !email.trim() || !password) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const creds = await addTenant({ name: name.trim(), email: email.trim(), password })
      setCreated(creds)
      setCredentialOpen(true)
      setOpen(false)
      setName('')
      setEmail('')
      setPassword('')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create tenant')
    } finally {
      setSubmitting(false)
    }
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t('admin.title', 'Tenants')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('admin.subtitle', 'Manage installer accounts and their tenants')}
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          {t('admin.createTenant', 'Create Tenant')}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-center">
          <p className="text-destructive text-sm">{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={fetchTenants}>
            {t('common.retry', 'Retry')}
          </Button>
        </div>
      )}

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
      ) : (
        <div className="space-y-3">
          {tenants.map((tenant) => (
            <div key={tenant.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">{tenant.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm text-muted-foreground">{tenant.email}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-mono cursor-pointer select-all" onClick={() => copyToClipboard(tenant.id, tenant.id)}>
                  {tenant.id.slice(0, 8)}...
                </Badge>
                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(tenant.id, tenant.id)}>
                  {copiedId === tenant.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1 text-muted-foreground hover:text-amber-600"
                  onClick={() => { setResetTarget(tenant); setNewPassword('') }}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Reset PW
                </Button>
              </div>
            </div>
          ))}
          {tenants.length === 0 && !loading && (
            <div className="text-center py-12 border rounded-lg">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">{t('admin.noTenants', 'No tenants yet')}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t('admin.noTenantsDesc', 'Create your first installer tenant to get started.')}
              </p>
            </div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { if (!o) setOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('admin.createTenantTitle', 'Create New Tenant')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {submitError && (
              <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">{submitError}</div>
            )}
            <div className="space-y-1">
              <Label>{t('admin.tenantName', 'Company Name')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Electricidad Diego" autoFocus />
            </div>
            <div className="space-y-1">
              <Label>{t('admin.installerEmail', 'Installer Email')}</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="installer@empresa.com" />
            </div>
            <div className="space-y-1">
              <Label>{t('admin.password', 'Password')}</Label>
              <div className="relative">
                <Input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="pr-10"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowPw(!showPw)}
                  type="button"
                >
                  {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
            <Button onClick={handleCreate} disabled={submitting || !name || !email || !password}>
              {submitting ? t('common.creating', 'Creating...') : t('common.create', 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials dialog — shown after tenant creation */}
      <Dialog open={credentialOpen} onOpenChange={(o) => { if (!o) { setCredentialOpen(false); setCreated(null); setRevealPw(false) } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('admin.tenantCreated', 'Tenant Created')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 rounded-lg p-4 text-center">
              <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                {t('admin.credentialsNote', 'Share these credentials with the installer. They will NOT be shown again.')}
              </p>
              <div className="space-y-2 text-left">
                <div className="flex items-center justify-between bg-white dark:bg-gray-900 rounded px-3 py-2 border">
                  <span className="text-xs text-muted-foreground">Email</span>
                  <span className="text-sm font-mono font-semibold">{created?.email}</span>
                </div>
                <div className="flex items-center justify-between bg-white dark:bg-gray-900 rounded px-3 py-2 border">
                  <span className="text-xs text-muted-foreground">Password</span>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-mono font-semibold">
                      {revealPw ? created?.password : '••••••••'}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setRevealPw(!revealPw)}
                      type="button"
                    >
                      {revealPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        if (!created) return
                        navigator.clipboard.writeText('Email: ' + created.email + '\nPassword: ' + created.password)
                        setCopiedId('creds')
                        setTimeout(() => setCopiedId(null), 2000)
                      }}
                    >
                      {copiedId === 'creds' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <Button className="w-full" onClick={() => { setCredentialOpen(false); setCreated(null); setPassword('') }}>
              {t('common.done', 'Done')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(o) => { if (!o) setResetTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('admin.resetPassword', 'Reset Installer Password')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {t('admin.resetPasswordDesc', 'Set a new password for')}{' '}
              <strong>{resetTarget?.name}</strong>
            </p>
            <div className="space-y-1">
              <Label>{t('admin.newPassword', 'New Password')}</Label>
              <div className="relative">
                <Input
                  type={showResetPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  autoFocus
                  className="pr-10"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowResetPw(!showResetPw)}
                  type="button"
                >
                  {showResetPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
            {created && (
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 rounded-lg p-3 text-center">
                <p className="text-xs text-green-800 dark:text-green-200 mb-2">
                  {t('admin.newCredentials', 'New credentials — share with installer:')}
                </p>
                <p className="text-sm font-mono font-semibold">{created.email} / <span>{revealPw ? created.password : '••••••••'}</span></p>
                <div className="flex items-center justify-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setRevealPw(!revealPw)}
                    type="button"
                  >
                    {revealPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 gap-1"
                  onClick={() => {
                    navigator.clipboard.writeText('Email: ' + created.email + '\nPassword: ' + created.password)
                    setCopiedId('reset')
                    setTimeout(() => setCopiedId(null), 2000)
                  }}
                >
                  {copiedId === 'reset' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  Copy
                </Button>
              </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetTarget(null); setCreated(null) }}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={async () => {
                if (!newPassword || newPassword.length < 6 || !resetTarget) return
                setResetting(true)
                try {
                  const creds = await resetPassword(resetTarget.id, newPassword)
                  setCreated(creds)
                } catch {
                  // handled by store
                } finally {
                  setResetting(false)
                }
              }}
              disabled={resetting || !newPassword || newPassword.length < 6}
            >
              {resetting ? t('common.saving', 'Saving...') : t('admin.resetButton', 'Reset Password')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
