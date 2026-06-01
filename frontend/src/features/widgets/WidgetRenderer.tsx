import { Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getWidgetDef } from "./registry";
import { useWidgetConfigStore } from "@/stores/widgetConfigStore";
import { useTelemetryValue } from "@/stores/telemetryStore";
import type { WidgetLayoutEntry } from "./types";

interface WidgetRendererProps {
	entry: WidgetLayoutEntry;
	/** When true, shows the settings gear button and enables drag handles on the grid. */
	isEditing: boolean;
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
	const openConfig = useWidgetConfigStore((s) => s.openConfig);
	const def = getWidgetDef(entry.widgetType);

	// Subscribe to telemetry for this widget to force react-grid-layout to propagate DOM updates.
	// react-grid-layout memoizes children internally and can block re-renders when only the
	// deeply-nested widget component triggers an update via Zustand. By subscribing to the
	// widget's telemetry key here, WidgetRenderer (the grid child) re-renders when data changes,
	// ensuring react-grid-layout sees the new JSX.
	useTelemetryValue(
		entry.config.deviceId ?? "",
		entry.config.datastreamKey ?? "",
	);

	return (
		<Card className="h-full w-full flex flex-col overflow-hidden">
			<CardHeader className="py-1.5 px-2 flex-row items-center justify-between space-y-0 flex-shrink-0 min-h-0">
				<CardTitle className="text-[11px] sm:text-sm font-medium truncate leading-tight">
					{entry.config.name || def?.label || entry.widgetType}
				</CardTitle>
				{isEditing && (
					<Button
						variant="ghost"
						size="icon"
						className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0"
						onClick={(e) => {
							e.stopPropagation();
							openConfig(entry.i);
						}}
					>
						<Settings className="h-3 w-3" />
					</Button>
				)}
			</CardHeader>
			<CardContent className="flex-1 p-1.5 overflow-hidden [&_svg]:max-w-full [&_canvas]:max-w-full">
				{def ? (
					<def.component
						widgetId={entry.i}
						config={entry.config}
						isEditing={isEditing}
					/>
				) : (
					<div className="flex items-center justify-center h-full text-[10px] sm:text-sm text-destructive">
						Unknown widget type:{" "}
						<code className="ml-1 font-mono text-[10px]">
							{entry.widgetType}
						</code>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
