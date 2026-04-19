import { useState } from 'react'
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
  const { createTemplate } = useTemplateStore()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [datastreams, setDatastreams] = useState<Datastream[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicateKeys, setDuplicateKeys] = useState<Set<string>>(new Set())

  function validate(): boolean {
    // Name required
    if (!name.trim()) return false

    // Datastream keys: non-empty and unique
    const keys = datastreams.map((d) => d.key.trim())
    const emptyKey = keys.some((k) => k === '')
    if (emptyKey) {
      setError('Todos los datastreams deben tener una clave')
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
      setError('Las claves de los datastreams deben ser únicas')
      return false
    }

    // Name required in each datastream
    const emptyName = datastreams.some((d) => !d.name.trim())
    if (emptyName) {
      setError('Todos los datastreams deben tener un nombre')
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
      setError(err instanceof Error ? err.message : 'Error al crear plantilla')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva plantilla</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error && (
            <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-1">
            <Label>Nombre *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Sensor de temperatura"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label>Descripción</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción opcional"
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
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? 'Creando…' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
