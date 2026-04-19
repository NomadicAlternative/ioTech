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
import { useTemplateStore } from '../templateStore'
import { DatastreamEditor } from './DatastreamEditor'
import type { Datastream } from '@/features/widgets/types'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export function CreateTemplateDialog({ onClose, onSuccess }: Props) {
  const { t } = useTranslation()
  const { createTemplate } = useTemplateStore()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [datastreams, setDatastreams] = useState<Datastream[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicateKeys, setDuplicateKeys] = useState<Set<string>>(new Set())

  function validate(): boolean {
    if (!name.trim()) return false

    const keys = datastreams.map((d) => d.key.trim())
    const emptyKey = keys.some((k) => k === '')
    if (emptyKey) {
      setError(t('templates.datastream.errorEmptyKey'))
      return false
    }

    const keySet = new Set(keys)
    if (keySet.size !== keys.length) {
      const seen = new Set<string>()
      const dupes = new Set<string>()
      for (const k of keys) {
        if (seen.has(k)) dupes.add(k)
        seen.add(k)
      }
      setDuplicateKeys(dupes)
      setError(t('templates.datastream.errorDuplicateKeys'))
      return false
    }

    const emptyName = datastreams.some((d) => !d.name.trim())
    if (emptyName) {
      setError(t('templates.datastream.errorEmptyName'))
      return false
    }

    setDuplicateKeys(new Set())
    setError(null)
    return true
  }

  async function handleSave() {
    if (!validate()) return

    setSaving(true)
    setError(null)
    try {
      await createTemplate({
        name: name.trim(),
        description: description.trim() || undefined,
        datastreams,
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('templates.create.errorCreate'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('templates.create.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error && (
            <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-1">
            <Label>{t('common.nameLabel')}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('templates.create.namePlaceholder')}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label>{t('common.descLabel')}</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('templates.create.descPlaceholder')}
            />
          </div>
          <DatastreamEditor
            datastreams={datastreams}
            onChange={setDatastreams}
            duplicateKeys={duplicateKeys}
          />
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
