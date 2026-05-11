import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, File } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useFirmwareStore } from './firmwareStore'
import type { FirmwareVersion } from './types'
import api from '@/lib/axios'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface FirmwareFormProps {
  open: boolean
  onClose: () => void
  firmware?: FirmwareVersion | null
}

interface FormData {
  version: string
  hardware_model: string
  release_notes: string
  download_url: string
}

interface FormErrors {
  version?: string
  hardware_model?: string
  download_url?: string
}

const initialState: FormData = {
  version: '',
  hardware_model: '',
  release_notes: '',
  download_url: '',
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function FirmwareForm({ open, onClose, firmware }: FirmwareFormProps) {
  const { t } = useTranslation()
  const { createFirmware, updateFirmware } = useFirmwareStore()

  const [form, setForm] = useState<FormData>(initialState)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isEdit = !!firmware

  // Populate form when editing
  useEffect(() => {
    if (firmware) {
      setForm({
        version: firmware.version,
        hardware_model: firmware.hardware_model,
        release_notes: firmware.release_notes ?? '',
        download_url: firmware.download_url,
      })
    } else {
      setForm(initialState)
    }
    setErrors({})
    setSubmitError(null)
    setFile(null)
  }, [firmware, open])

  // ── Helpers ────────────────────────────────────────────────────────────────

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }

  function validate(): boolean {
    const newErrors: FormErrors = {}
    if (!form.version.trim()) {
      newErrors.version = t('firmware.form.errors.versionRequired', 'Version is required')
    }
    if (!form.hardware_model.trim()) {
      newErrors.hardware_model = t('firmware.form.errors.hwModelRequired', 'Hardware model is required')
    }
    if (!file && !form.download_url.trim()) {
      newErrors.download_url = t('firmware.form.errors.urlOrFile', 'Upload a file or provide a download URL')
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      if (file) {
        // Multipart upload with file
        const formData = new FormData()
        formData.append('version', form.version.trim())
        formData.append('hardware_model', form.hardware_model.trim())
        if (form.release_notes.trim()) formData.append('release_notes', form.release_notes.trim())
        formData.append('file', file)
        await api.post('/api/firmware/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      } else {
        const payload = {
          version: form.version.trim(),
          hardware_model: form.hardware_model.trim(),
          release_notes: form.release_notes.trim() || null,
          download_url: form.download_url.trim(),
        }

        if (isEdit && firmware) {
          await updateFirmware(firmware.id, payload)
        } else {
          await createFirmware(payload)
        }
      }
      onClose()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save firmware')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t('firmware.form.editTitle', 'Edit Firmware Version')
              : t('firmware.form.createTitle', 'Add Firmware Version')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Submit error */}
          {submitError && (
            <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
              {submitError}
            </div>
          )}

          {/* ── Version ────────────────────────────────────────────────────── */}
          <div className="space-y-1">
            <Label>{t('firmware.form.version', 'Version')}</Label>
            <Input
              value={form.version}
              onChange={(e) => updateField('version', e.target.value)}
              placeholder="e.g. 2.1.0"
              autoFocus
            />
            {errors.version && (
              <p className="text-destructive text-xs mt-1">{errors.version}</p>
            )}
          </div>

          {/* ── Hardware Model ─────────────────────────────────────────────── */}
          <div className="space-y-1">
            <Label>{t('firmware.form.hardwareModel', 'Hardware Model')}</Label>
            <Input
              value={form.hardware_model}
              onChange={(e) => updateField('hardware_model', e.target.value)}
              placeholder="e.g. ESP32-DevKitC"
            />
            {errors.hardware_model && (
              <p className="text-destructive text-xs mt-1">{errors.hardware_model}</p>
            )}
          </div>

          {/* ── File Upload ──────────────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label>{t('firmware.form.fileUpload', 'Firmware binary (.bin)')}</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".bin"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/50 px-3 py-2">
                <File className="h-4 w-4 text-[var(--muted-foreground)]" />
                <span className="text-sm truncate flex-1">{file.name}</span>
                <Button variant="ghost" size="icon-sm" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}>
                  ✕
                </Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                {t('firmware.form.selectFile', 'Select .bin file')}
              </Button>
            )}
          </div>

          {/* ── Download URL (optional when file is uploaded) ──────────────────── */}
          {!file && (
            <div className="space-y-1">
              <Label>{t('firmware.form.downloadUrl', 'Download URL')}</Label>
              <Input
                value={form.download_url}
                onChange={(e) => updateField('download_url', e.target.value)}
                placeholder="https://example.com/firmware.bin"
              />
              {errors.download_url && (
                <p className="text-destructive text-xs mt-1">{errors.download_url}</p>
              )}
            </div>
          )}

          {/* ── Release Notes ──────────────────────────────────────────────── */}
          <div className="space-y-1">
            <Label>{t('firmware.form.releaseNotes', 'Release Notes')}</Label>
            <Input
              value={form.release_notes}
              onChange={(e) => updateField('release_notes', e.target.value)}
              placeholder={t('firmware.form.releaseNotesPlaceholder', 'Optional release notes')}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting
              ? t('common.saving', 'Saving...')
              : isEdit
                ? t('common.save', 'Save')
                : t('common.create', 'Create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
