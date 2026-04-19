import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Datastream } from '@/features/widgets/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  datastreams: Datastream[]
  onChange: (datastreams: Datastream[]) => void
  /** Set of duplicate keys — rows with these keys show an error */
  duplicateKeys?: Set<string>
}

const EMPTY_ROW: () => Datastream = () => ({
  key: '',
  name: '',
  type: 'number',
  direction: '',
  unit: '',
})

// ─── Component ────────────────────────────────────────────────────────────────

export function DatastreamEditor({ datastreams, onChange, duplicateKeys }: Props) {
  function handleChange(index: number, field: keyof Datastream, value: string | number) {
    const updated = datastreams.map((row, i) => {
      if (i !== index) return row
      const next = { ...row, [field]: value }
      // Clear min/max when type is not number
      if (field === 'type' && value !== 'number') {
        delete next.min
        delete next.max
      }
      return next
    })
    onChange(updated)
  }

  function handleAdd() {
    onChange([...datastreams, EMPTY_ROW()])
  }

  function handleRemove(index: number) {
    onChange(datastreams.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Datastreams</span>
        <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="h-3 w-3 mr-1" />
          Agregar
        </Button>
      </div>

      {datastreams.length === 0 && (
        <p className="text-xs text-muted-foreground py-2">
          No hay datastreams. Hacé clic en "Agregar" para añadir uno.
        </p>
      )}

      {datastreams.map((row, i) => {
        const isDuplicate = duplicateKeys?.has(row.key) && row.key !== ''
        return (
          <div key={i} className="border rounded-md p-3 space-y-2 bg-muted/20">
            <div className="grid grid-cols-2 gap-2">
              {/* Key */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Clave *</label>
                <Input
                  value={row.key}
                  onChange={(e) => handleChange(i, 'key', e.target.value)}
                  placeholder="ej. temperature"
                  className={isDuplicate ? 'border-destructive' : ''}
                />
                {isDuplicate && (
                  <p className="text-destructive text-xs">Clave duplicada</p>
                )}
              </div>
              {/* Name */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Nombre *</label>
                <Input
                  value={row.name}
                  onChange={(e) => handleChange(i, 'name', e.target.value)}
                  placeholder="ej. Temperatura"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* Type */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Tipo</label>
                <Select
                  value={row.type || 'number'}
                  onValueChange={(v) => handleChange(i, 'type', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="number">Número</SelectItem>
                    <SelectItem value="string">Texto</SelectItem>
                    <SelectItem value="boolean">Booleano</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Direction */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Dirección</label>
                <Select
                  value={row.direction || ''}
                  onValueChange={(v) => handleChange(i, 'direction', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="input">Input</SelectItem>
                    <SelectItem value="output">Output</SelectItem>
                    <SelectItem value="bidirectional">Bidireccional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Unit */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Unidad</label>
                <Input
                  value={row.unit ?? ''}
                  onChange={(e) => handleChange(i, 'unit', e.target.value)}
                  placeholder="ej. °C"
                />
              </div>
            </div>

            {/* Min / Max — only for number type */}
            {(row.type === 'number' || !row.type) && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Mínimo</label>
                  <Input
                    type="number"
                    value={row.min ?? ''}
                    onChange={(e) =>
                      handleChange(i, 'min', e.target.value === '' ? '' : Number(e.target.value))
                    }
                    placeholder="ej. 0"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Máximo</label>
                  <Input
                    type="number"
                    value={row.max ?? ''}
                    onChange={(e) =>
                      handleChange(i, 'max', e.target.value === '' ? '' : Number(e.target.value))
                    }
                    placeholder="ej. 100"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-destructive hover:text-destructive"
                onClick={() => handleRemove(i)}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Quitar
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
