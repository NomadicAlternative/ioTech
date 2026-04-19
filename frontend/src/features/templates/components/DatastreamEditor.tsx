import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()

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
        <span className="text-sm font-medium">{t('templates.datastream.title')}</span>
        <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="h-3 w-3 mr-1" />
          {t('templates.datastream.addButton')}
        </Button>
      </div>

      {datastreams.length === 0 && (
        <p className="text-xs text-muted-foreground py-2">
          {t('templates.datastream.empty')}
        </p>
      )}

      {datastreams.map((row, i) => {
        const isDuplicate = duplicateKeys?.has(row.key) && row.key !== ''
        return (
          <div key={i} className="border rounded-md p-3 space-y-2 bg-muted/20">
            <div className="grid grid-cols-2 gap-2">
              {/* Key */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t('templates.datastream.keyLabel')}</label>
                <Input
                  value={row.key}
                  onChange={(e) => handleChange(i, 'key', e.target.value)}
                  placeholder="ej. temperature"
                  className={isDuplicate ? 'border-destructive' : ''}
                />
                {isDuplicate && (
                  <p className="text-destructive text-xs">{t('templates.datastream.duplicateKey')}</p>
                )}
              </div>
              {/* Name */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t('templates.datastream.nameLabel')}</label>
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
                <label className="text-xs text-muted-foreground">{t('templates.datastream.typeLabel')}</label>
                <Select
                  value={row.type || 'number'}
                  onValueChange={(v) => handleChange(i, 'type', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="number">{t('templates.datastream.typeNumber')}</SelectItem>
                    <SelectItem value="string">{t('templates.datastream.typeString')}</SelectItem>
                    <SelectItem value="boolean">{t('templates.datastream.typeBoolean')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Direction */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t('templates.datastream.directionLabel')}</label>
                <Select
                  value={row.direction || ''}
                  onValueChange={(v) => handleChange(i, 'direction', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="input">{t('templates.datastream.dirInput')}</SelectItem>
                    <SelectItem value="output">{t('templates.datastream.dirOutput')}</SelectItem>
                    <SelectItem value="bidirectional">{t('templates.datastream.dirBidirectional')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Unit */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t('templates.datastream.unitLabel')}</label>
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
                  <label className="text-xs text-muted-foreground">{t('templates.datastream.minLabel')}</label>
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
                  <label className="text-xs text-muted-foreground">{t('templates.datastream.maxLabel')}</label>
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
                {t('templates.datastream.removeButton')}
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
