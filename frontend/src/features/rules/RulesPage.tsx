import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, FileWarning, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useRulesStore } from './rulesStore'
import { RuleForm } from './RuleForm'
import type { Rule } from './rulesApi'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatLastFired(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

function triggerTypeLabel(tt: string): string {
  return tt === 'threshold' ? 'Threshold' : 'Status'
}

function actionTypeLabel(at: string): string {
  return at === 'relay' ? 'Relay' : 'Command'
}

// ─── Page component ───────────────────────────────────────────────────────────

export function RulesPage() {
  const { t } = useTranslation()
  const { rules, loading, error, fetchRules, updateRule, deleteRule } = useRulesStore()

  const [createOpen, setCreateOpen] = useState(false)
  const [editRule, setEditRule] = useState<Rule | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleToggle(rule: Rule) {
    await updateRule(rule.id, { enabled: !rule.enabled })
  }

  function handleNewRule() {
    setEditRule(null)
    setCreateOpen(true)
  }

  function handleEdit(rule: Rule) {
    setEditRule(rule)
    setCreateOpen(true)
  }

  function handleCloseForm() {
    setCreateOpen(false)
    setEditRule(null)
    fetchRules()
  }

  async function handleConfirmDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      await deleteRule(deleteId)
      setDeleteId(null)
      fetchRules()
    } catch {
      // error handled by store
    } finally {
      setDeleting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border)]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t('rules.list.title', 'Automation Rules')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('rules.list.subtitle', 'Define rules that trigger actions based on device data')}
          </p>
        </div>
        <Button onClick={handleNewRule}>
          <Plus className="h-4 w-4 mr-2" />
          {t('rules.list.newButton', 'New Rule')}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--border)]">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                {t('rules.list.colName', 'Name')}
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider hidden sm:table-cell">
                {t('rules.list.colTrigger', 'Trigger')}
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider hidden sm:table-cell">
                {t('rules.list.colAction', 'Action')}
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider hidden md:table-cell">
                {t('rules.list.colEnabled', 'Enabled')}
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider hidden lg:table-cell">
                {t('rules.list.colCooldown', 'Cooldown')}
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider hidden lg:table-cell">
                {t('rules.list.colLastFired', 'Last Fired')}
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {/* Loading skeleton */}
            {loading &&
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-t animate-pulse" data-testid="skeleton-row">
                  <td className="px-4 py-3">
                    <div className="h-4 bg-muted rounded w-3/4" />
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="h-4 bg-muted rounded w-20" />
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="h-4 bg-muted rounded w-16" />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="h-4 bg-muted rounded w-10" />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="h-4 bg-muted rounded w-16" />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="h-4 bg-muted rounded w-24" />
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              ))}

            {/* Empty state */}
            {!loading && rules.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <FileWarning className="h-12 w-12 opacity-30" />
                    <p className="font-medium">
                      {t('rules.list.empty', 'No rules yet')}
                    </p>
                    <p className="text-xs">
                      {t('rules.list.emptySubtitle', 'Create your first automation rule')}
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {/* Rule rows */}
            {!loading &&
              rules.map((rule) => (
                <tr key={rule.id} className="border-t hover:bg-[var(--blue)]/3 transition-colors group">
                  <td className="px-4 py-3 font-medium">{rule.name}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    <Badge variant="secondary">{triggerTypeLabel(rule.triggerType)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    <Badge variant="secondary">{actionTypeLabel(rule.actionType)}</Badge>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={() => handleToggle(rule)}
                      size="sm"
                    />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {rule.cooldownMs}ms
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {formatLastFired(rule.lastFiredAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleEdit(rule)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(rule.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* ── Create / Edit RuleForm dialog ──────────────────────────────────── */}
      <RuleForm
        open={createOpen || !!editRule}
        onClose={handleCloseForm}
        rule={editRule}
      />

      {/* ── Delete confirmation dialog ──────────────────────────────────────── */}
      <Dialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('rules.delete.title', 'Delete Rule')}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground">
              {t('rules.delete.confirm', 'Are you sure you want to delete this rule?')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? t('common.deleting', 'Deleting...') : t('common.delete', 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
