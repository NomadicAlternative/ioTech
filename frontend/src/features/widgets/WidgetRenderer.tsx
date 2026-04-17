import { Settings } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getWidgetDef } from './registry'
import { useWidgetConfigStore } from '@/stores/widgetConfigStore'
import type { WidgetLayoutEntry } from './types'

interface WidgetRendererProps {
  entry: WidgetLayoutEntry
  isEditing: boolean
}

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
