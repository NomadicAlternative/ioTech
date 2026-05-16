import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Building2, Copy, Check, KeyRound, Eye, EyeOff, ChevronDown, ChevronUp, Users, Mail, Sparkles, Zap, Clock, ShieldCheck, AlertTriangle, Trash2, AlertOctagon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { useAdminStore } from './adminStore'
import { resetPassword, deleteTenant } from './adminApi'
import type { Tenant } from './adminApi'

function generatePassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function getStatusConfig(status?: string) {
  switch (status) {
    case 'active': return { color: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', icon: ShieldCheck, label: 'Activo' }
    case 'trial': return { color: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', icon: Clock, label: 'Trial' }
    case 'expired': return { color: 'bg-red-500', text: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', icon: AlertTriangle, label: 'Expirado' }
    default: return { color: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', icon: Building2, label: status || 'Desconocido' }
  }
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

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
  const [expandedTenants, setExpandedTenants] = useState<Set<string>>(new Set())
  const [generatedPw, setGeneratedPw] = useState<Record<string, { password: string; revealed: boolean }>>({})
  const [generatingPw, setGeneratingPw] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleGeneratePassword(tenant: Tenant) {
    const pw = generatePassword()
    setGeneratingPw((prev) => new Set(prev).add(tenant.id))
    try {
      await resetPassword(tenant.id, pw)
      setGeneratedPw((prev) => ({ ...prev, [tenant.id]: { password: pw, revealed: false } }))
    } catch {
      // ignore
    } finally {
      setGeneratingPw((prev) => {
        const next = new Set(prev)
        next.delete(tenant.id)
        return next
      })
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteTenant(deleteTarget.id)
      setDeleteTarget(null)
      setDeleteConfirmText('')
      fetchTenants()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Error al eliminar')
    } finally {
      setDeleting(false)
    }
  }

  function toggleExpand(id: string) {
    setExpandedTenants((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border)]">
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
          {tenants.map((tenant) => {
            const isExpanded = expandedTenants.has(tenant.id)
            const statusCfg = getStatusConfig(tenant.status)
            const StatusIcon = statusCfg.icon
            const pw = generatedPw[tenant.id]
            const isGenerating = generatingPw.has(tenant.id)
            return (
            <div key={tenant.id} className="border-2 border-blue-200 dark:border-blue-800 rounded-xl overflow-hidden transition-all duration-200 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                    {getInitials(tenant.name)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{tenant.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{tenant.email}</span>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.text}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                      </span>
                      {tenant.plan && tenant.plan !== 'base' && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{tenant.plan}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                    onClick={() => { setDeleteTarget(tenant); setDeleteConfirmText(''); setDeleteError(null) }}
                    title="Eliminar tenant"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => toggleExpand(tenant.id)}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t px-4 py-4 space-y-5 bg-gradient-to-b from-blue-50/30 to-background dark:from-blue-950/10">
                  {/* Credenciales */}
                  <div className="bg-background rounded-xl border p-4 shadow-sm">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <KeyRound className="w-3 h-3" />
                      Credenciales de acceso
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Usuario */}
                      <div className="flex items-center gap-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg px-3.5 py-3 border border-blue-100 dark:border-blue-900">
                        <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
                          <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Usuario</p>
                          <p className="text-sm font-mono font-semibold truncate">{tenant.adminEmail || tenant.email}</p>
                        </div>
                      </div>

                      {/* Contraseña */}
                      <div className="flex items-center gap-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg px-3.5 py-3 border border-blue-100 dark:border-blue-900">
                        <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0">
                          <KeyRound className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Contraseña</p>
                          {pw ? (
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-mono font-semibold tabular-nums">
                                {pw.revealed ? pw.password : '••••••••••••'}
                              </p>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => setGeneratedPw((prev) => ({ ...prev, [tenant.id]: { ...pw, revealed: !pw.revealed } }))}
                              >
                                {pw.revealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => { navigator.clipboard.writeText(pw.password); setCopiedId(`pw-${tenant.id}`); setTimeout(() => setCopiedId(null), 2000) }}
                              >
                                {copiedId === `pw-${tenant.id}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50 shrink-0 ml-1"
                                onClick={() => handleGeneratePassword(tenant)}
                                disabled={isGenerating}
                              >
                                {isGenerating ? <Sparkles className="w-3 h-3 animate-pulse" /> : <Zap className="w-3 h-3" />}
                                Resetear
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              className="h-8 text-xs gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
                              onClick={() => handleGeneratePassword(tenant)}
                              disabled={isGenerating}
                            >
                              {isGenerating ? (
                                <><Sparkles className="w-3.5 h-3.5 animate-pulse" /> Generando...</>
                              ) : (
                                <><Zap className="w-3.5 h-3.5" /> Generar contraseña</>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Clientes */}
                  <div className="bg-background rounded-xl border p-4 shadow-sm">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <Users className="w-3 h-3" />
                      Clientes ({tenant.clients?.length || 0})
                    </h4>
                    {tenant.clients && tenant.clients.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {tenant.clients.map((client) => (
                          <div key={client.id} className="flex items-center gap-3 bg-blue-50/30 dark:bg-blue-950/10 rounded-lg px-3 py-2.5 border border-blue-100 dark:border-blue-900 hover:shadow-sm transition-shadow">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                              {getInitials(client.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{client.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{client.email || 'Sin email'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 rounded-lg border border-dashed border-blue-200 dark:border-blue-800">
                        <Users className="w-6 h-6 text-blue-300 dark:text-blue-700 mx-auto mb-1.5" />
                        <p className="text-xs text-muted-foreground">Sin clientes registrados</p>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
                      onClick={() => copyToClipboard(tenant.id, tenant.id)}
                    >
                      <span className="opacity-50">ID:</span> {tenant.id.slice(0, 12)}...
                      {copiedId === tenant.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 opacity-40" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )})}
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

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteConfirmText(''); setDeleteError(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertOctagon className="w-5 h-5" />
              Eliminar tenant
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
                ¿Eliminar <strong>{deleteTarget?.name}</strong>?
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">
                Esta acción es <strong>IRREVERSIBLE</strong>. Se eliminará permanentemente:
              </p>
              <ul className="text-xs text-red-600 dark:text-red-400 mt-2 space-y-0.5 list-disc list-inside">
                <li>Todos los usuarios del tenant</li>
                <li>Todos los dispositivos</li>
                <li>Todos los clientes</li>
                <li>Todos los dashboards</li>
                <li>Todas las reglas de automatización</li>
                <li>Todo el historial de telemetría</li>
                <li>Las credenciales de acceso</li>
              </ul>
              <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-medium">
                No se puede recuperar.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">
                Escribí <strong className="font-mono text-red-600">ELIMINAR</strong> para confirmar:
              </Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="ELIMINAR"
                className="font-mono"
                autoFocus
              />
            </div>

            {deleteError && (
              <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">{deleteError}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteConfirmText(''); setDeleteError(null) }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || deleteConfirmText !== 'ELIMINAR'}
              className="gap-2"
            >
              {deleting ? (
                <>Eliminando...</>
              ) : (
                <><Trash2 className="w-4 h-4" /> Eliminar para siempre</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
