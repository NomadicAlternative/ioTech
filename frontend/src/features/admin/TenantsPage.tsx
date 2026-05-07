import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Building2, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { useAdminStore } from './adminStore'

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

  useEffect(() => { fetchTenants() }, [])

  async function handleCreate() {
    if (!name.trim() || !email.trim() || !password) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await addTenant({ name: name.trim(), email: email.trim(), password })
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
          <h1 className="text-2xl font-bold">{t('admin.title', 'Tenants')}</h1>
          <p className="text-muted-foreground mt-1">
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
              </div>
            </div>
          ))}
          {tenants.length === 0 && !loading && (
            <div className="text-center py-12 border rounded-lg">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">{t('admin.noTenants', 'No tenants yet')}</h3>
              <p className="text-muted-foreground mt-1">
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
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" />
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
    </div>
  )
}
