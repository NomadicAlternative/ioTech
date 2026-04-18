import { Settings } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getWidgetDef } from './registry'
import { useWidgetConfigStore } from '@/stores/widgetConfigStore'
import type { WidgetLayoutEntry } from './types'

interface WidgetRendererProps {
  entry: WidgetLayoutEntry
  /** When true, shows the settings gear button and enables drag handles on the grid. */
  isEditing: boolean
}

/**
 * Renders a single widget cell inside the dashboard grid.
 *
 * - Looks up the widget component via `getWidgetDef(entry.widgetType)`.
 * - In edit mode, shows a settings gear button that opens `WidgetConfigPanel`.
 * - Displays an error state for unknown widget types (e.g. registry entries removed after save).
 * - The widget's `config.name` is used as the card header label (REQ-DASH-012).
 */
export function WidgetRenderer({ entry, isEditing }: WidgetRendererProps) {
  const openConfig = useWidgetConfigStore((s) => s.openConfig)
  const def = getWidgetDef(entry.widgetType)

  return (
    <Card className="h-full w-full flex flex-col overflow-hidden">
      <CardHeader className="py-2 px-3 flex-row items-center justify-between space-y-0 flex-shrink-0">
        <CardTitle className="text-sm font-medium truncate">{entry.config.name || def?.label || entry.widgetType}</CardTitle>
        {isEditing && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              openConfig(entry.i)
            }}
          >
            <Settings className="h-3 w-3" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 p-2 overflow-hidden">
        {def ? (
          <def.component
            widgetId={entry.i}
            config={entry.config}
            isEditing={isEditing}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-destructive">
            Unknown widget type: <code className="ml-1 font-mono">{entry.widgetType}</code>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
