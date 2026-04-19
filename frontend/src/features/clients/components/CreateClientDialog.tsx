import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useClientStore } from '../clientStore'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export function CreateClientDialog({ onClose, onSuccess }: Props) {
  const { t } = useTranslation()
  const { createClient } = useClientStore()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim()) return

    setSaving(true)
    setError(null)
    try {
      await createClient({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('clients.create.errorCreate'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('clients.create.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error && (
            <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-1">
            <Label>{t('clients.fields.nameLabel')}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('clients.create.namePlaceholder')}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label>{t('clients.fields.emailLabel')}</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('clients.fields.emailPlaceholder')}
            />
          </div>
          <div className="space-y-1">
            <Label>{t('clients.fields.phoneLabel')}</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('clients.fields.phonePlaceholder')}
            />
          </div>
          <div className="space-y-1">
            <Label>{t('clients.fields.addressLabel')}</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t('clients.fields.addressPlaceholder')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? t('common.creating') : t('common.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
