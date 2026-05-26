import { useMemo } from "react";
import { Cpu, ArrowRight } from "lucide-react";

interface ConnectionDiagramProps {
	diagrama: string;
}

interface Connection {
	from: string;
	to: string;
	color: string;
}

const GPIO_COLORS: Record<string, string> = {
	"3.3V": "#f59e0b", // amber
	"5V": "#ef4444", // red
	GND: "#6b7280", // gray
	SDA: "#3b82f6", // blue
	SCL: "#8b5cf6", // purple
	default: "#10b981", // green
};

function getLineColor(connection: string): string {
	if (connection.includes("3.3V")) return GPIO_COLORS["3.3V"];
	if (connection.includes("5V")) return GPIO_COLORS["5V"];
	if (connection.includes("GND")) return GPIO_COLORS["GND"];
	if (connection.includes("SDA")) return GPIO_COLORS["SDA"];
	if (connection.includes("SCL")) return GPIO_COLORS["SCL"];
	return GPIO_COLORS["default"];
}

function getDeviceIcon(label: string): string {
	if (label.includes("DHT22")) return "🌡️";
	if (label.includes("BME280")) return "🌤️";
	if (label.includes("PIR")) return "👁️";
	if (label.includes("HC-SR04")) return "📏";
	if (label.includes("Buzzer")) return "🔊";
	if (label.includes("Relay") || label.includes("Relé")) return "⚡";
	if (label.includes("Servo")) return "🔄";
	if (label.includes("DS18B20")) return "🌡️";
	if (label.includes("WS2812B")) return "💡";
	if (label.includes("SSD1306") || label.includes("LCD1602")) return "🖥️";
	if (label.includes("Pull-up")) return "⚠️";
	return "🔌";
}

function parseDiagram(diagrama: string): {
	connections: Connection[];
	devices: string[];
	warnings: string[];
} {
	const lines = diagrama.split("\\n").filter((l) => l.trim());
	const connections: Connection[] = [];
	const devices: string[] = [];
	const warnings: string[] = [];
	const deviceSet = new Set<string>();

	for (const line of lines) {
		// Match "ESP32 GPIO32 → DHT22 DAT" pattern
		const arrowMatch = line.match(/(.+?)\s*→\s*(.+)/);
		if (arrowMatch) {
			const from = arrowMatch[1].trim();
			const to = arrowMatch[2].trim();
			const color = getLineColor(line);
			connections.push({ from, to, color });

			// Extract device name
			const devicePart = to.split(" ")[0];
			if (
				devicePart &&
				!devicePart.includes("GPIO") &&
				!devicePart.includes("ESP32") &&
				!devicePart.includes("3.3V") &&
				!devicePart.includes("5V") &&
				!devicePart.includes("GND") &&
				!devicePart.includes("Pull-up")
			) {
				deviceSet.add(devicePart);
			}
		} else if (line.includes("⚠️")) {
			warnings.push(line.trim());
		}
	}

	return {
		connections,
		devices: [...deviceSet],
		warnings,
	};
}

export function ConnectionDiagram({ diagrama }: ConnectionDiagramProps) {
	const { connections, devices, warnings } = useMemo(
		() => parseDiagram(diagrama),
		[diagrama],
	);

	if (connections.length === 0) {
		return (
			<div className="text-xs text-muted-foreground italic py-2">
				Sin conexiones detectadas
			</div>
		);
	}

	// Group connections by device
	const deviceGroups = new Map<string, Connection[]>();
	for (const conn of connections) {
		const device = conn.to.split(" ")[0];
		if (!deviceGroups.has(device)) deviceGroups.set(device, []);
		deviceGroups.get(device)!.push(conn);
	}

	return (
		<div className="space-y-3">
			{/* Visual diagram */}
			<div className="relative rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 p-4 overflow-hidden">
				{/* Decorative background dots */}
				<div className="absolute inset-0 opacity-[0.03] pointer-events-none">
					<div
						className="w-full h-full"
						style={{
							backgroundImage:
								"radial-gradient(circle, currentColor 0.5px, transparent 0.5px)",
							backgroundSize: "12px 12px",
						}}
					/>
				</div>

				<div className="relative flex items-start gap-6">
					{/* ESP32 */}
					<div className="shrink-0 flex flex-col items-center gap-1.5">
						<div className="w-16 h-20 rounded-lg bg-[#1a1a2e] border-2 border-[#e94560] flex flex-col items-center justify-center gap-1 shadow-lg shadow-[#e94560]/10">
							<Cpu className="h-5 w-5 text-[#e94560]" />
							<span className="text-[10px] font-bold text-[#e94560] tracking-wide">
								ESP32
							</span>
						</div>
						<span className="text-[9px] text-muted-foreground">
							{devices.length > 0
								? `${devices.length} dispositivo${devices.length > 1 ? "s" : ""}`
								: "GPIO"}
						</span>
					</div>

					{/* Connections */}
					<div className="flex-1 min-w-0 space-y-2">
						{connections.map((conn, i) => (
							<div
								key={i}
								className="flex items-center gap-2 group animate-in fade-in slide-in-from-left-2"
								style={{
									animationDelay: `${i * 50}ms`,
									animationDuration: "300ms",
								}}
							>
								{/* From — ESP32 pin */}
								<div className="shrink-0 flex items-center gap-1.5">
									<div
										className={`h-7 px-2 rounded-md text-[10px] font-mono font-bold flex items-center border transition-colors group-hover:brightness-110`}
										style={{
											backgroundColor: `${conn.color}18`,
											borderColor: `${conn.color}40`,
											color: conn.color,
										}}
									>
										{conn.from}
									</div>
								</div>

								{/* Arrow */}
								<div className="flex-1 flex items-center">
									<div className="h-px flex-1 bg-[var(--border)] group-hover:bg-[var(--accent)]/50 transition-colors" />
									<ArrowRight className="h-3 w-3 -ml-1 text-muted-foreground group-hover:text-[var(--accent)] transition-colors" />
								</div>

								{/* To — device pin */}
								<div className="shrink-0 flex items-center gap-1">
									<span className="text-xs">{getDeviceIcon(conn.to)}</span>
									<span className="text-xs font-medium">{conn.to}</span>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>

			{/* Warnings */}
			{warnings.length > 0 && (
				<div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
					{warnings.map((w, i) => (
						<div
							key={i}
							className="text-[11px] text-amber-600 dark:text-amber-400"
						>
							{w}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
