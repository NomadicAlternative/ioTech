import { useEffect, useState } from "react";
import {
	Database,
	Activity,
	Server,
	AlertTriangle,
	CheckCircle,
	XCircle,
	Globe,
	Cpu,
} from "lucide-react";
import { fetchSystemHealth, type SystemHealth } from "./adminApi";
import { UpgradeGuide } from "./UpgradeGuide";

function StatusBadge({ level }: { level: "healthy" | "warning" | "critical" }) {
	const config = {
		healthy: {
			bg: "bg-green-500/10 text-green-600 border-green-200",
			icon: CheckCircle,
			label: "Healthy",
		},
		warning: {
			bg: "bg-amber-500/10 text-amber-600 border-amber-200",
			icon: AlertTriangle,
			label: "Warning",
		},
		critical: {
			bg: "bg-red-500/10 text-red-600 border-red-200",
			icon: XCircle,
			label: "Critical",
		},
	}[level];

	const Icon = config.icon;
	return (
		<span
			className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bg}`}
		>
			<Icon className="w-3.5 h-3.5" />
			{config.label}
		</span>
	);
}

function ProgressBar({
	percent,
	level,
}: {
	percent: number;
	level: "healthy" | "warning" | "critical";
}) {
	const color = {
		healthy: "bg-green-500",
		warning: "bg-amber-500",
		critical: "bg-red-500",
	}[level];

	return (
		<div className="w-full h-2 rounded-full bg-muted overflow-hidden">
			<div
				className={`h-full rounded-full transition-all duration-500 ${color}`}
				style={{ width: `${Math.min(percent, 100)}%` }}
			/>
		</div>
	);
}

function MetricRow({
	icon: Icon,
	label,
	value,
	sublabel,
	percent,
	level,
	help,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: string;
	sublabel?: string;
	percent: number;
	level: "healthy" | "warning" | "critical";
	help?: string;
}) {
	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Icon className="w-4 h-4 text-muted-foreground" />
					<span className="text-sm font-medium">{label}</span>
					{help && (
						<span
							className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-muted-foreground/30 text-[11px] text-muted-foreground cursor-help font-medium"
							title={help}
						>
							?
						</span>
					)}
				</div>
				<div className="flex items-center gap-2">
					<span className="text-sm tabular-nums font-mono">{value}</span>
					<StatusBadge level={level} />
				</div>
			</div>
			<ProgressBar percent={percent} level={level} />
			{sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
		</div>
	);
}

export function SystemHealthPanel() {
	const [health, setHealth] = useState<SystemHealth | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		const load = () => {
			fetchSystemHealth()
				.then((data) => {
					if (!cancelled) {
						setHealth(data);
						setLoading(false);
						setError(null);
					}
				})
				.catch((err) => {
					if (!cancelled) {
						setError(
							err instanceof Error ? err.message : "Failed to load health data",
						);
						setLoading(false);
					}
				});
		};

		load();
		const interval = setInterval(load, 60_000); // Refresh every minute
		return () => {
			cancelled = true;
			clearInterval(interval);
		};
	}, []);

	if (loading) {
		return (
			<div className="rounded-xl border p-5 animate-pulse">
				<div className="h-5 w-36 rounded bg-muted mb-4" />
				<div className="space-y-3">
					{[1, 2, 3].map((i) => (
						<div key={i} className="h-12 rounded bg-muted" />
					))}
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5">
				<p className="text-sm text-destructive">{error}</p>
			</div>
		);
	}

	if (!health) return null;

	return (
		<div className="rounded-xl border p-5 space-y-5">
			{/* Header */}
			<div className="flex items-center justify-between">
				<h2 className="text-base font-semibold flex items-center gap-2">
					<Activity className="w-4 h-4" />
					System Health
				</h2>
				<div className="flex items-center gap-2">
					<span className="text-xs text-muted-foreground">
						Updated: {new Date(health.sampled_at).toLocaleTimeString()}
					</span>
					<StatusBadge level={health.status} />
				</div>
			</div>

			{/* Alerts */}
			{health.alerts.length > 0 && (
				<div className="space-y-2">
					{health.alerts.map((alert, i) => (
						<div
							key={i}
							className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
								alert.level === "critical"
									? "bg-red-500/10 text-red-700 border border-red-200"
									: "bg-amber-500/10 text-amber-700 border border-amber-200"
							}`}
						>
							{alert.level === "critical" ? (
								<XCircle className="w-4 h-4 mt-0.5 shrink-0" />
							) : (
								<AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
							)}
							<span>{alert.message}</span>
						</div>
					))}
				</div>
			)}

			{/* Metrics */}
			<div className="space-y-4">
				<MetricRow
					icon={Database}
					label="Database"
					value={`${health.database.size_mb} MB / ${health.database.size_limit_mb} MB`}
					sublabel={`${health.database.percent}% used · ${health.database.largest_tables[0]?.table_name || "—"} is largest table`}
					percent={health.database.percent}
					level={health.database.level}
					help="Tamaño total de la base de datos en Neon (PostgreSQL). La telemetría, dispositivos y dashboards ocupan espacio. Neon escala automático."
				/>

				<MetricRow
					icon={Server}
					label="Connections"
					value={`${health.database.active_connections} / ${health.database.connection_limit}`}
					percent={health.database.connection_percent}
					level={health.database.connection_level}
					help="Conexiones activas entre el backend y PostgreSQL. Cada dashboard abierto usa 1 conexión del pool. Si se agotan, las requests hacen cola."
				/>

				<MetricRow
					icon={Activity}
					label="Backend Memory"
					value={`${health.backend.heap_mb} MB`}
					sublabel={`Uptime: ${health.backend.uptime_human} · Node ${health.backend.node_version} · ${health.backend.env}`}
					percent={health.backend.heap_percent}
					level={health.backend.heap_level}
					help="RAM usada por el proceso Node.js del backend. Crece con más dashboards abiertos (cada WebSocket ~1-2 MB). Si sube sin parar, puede haber memory leak."
				/>

				<MetricRow
					icon={Activity}
					label="CPU Load"
					value={`${health.cpu.percent}%`}
					sublabel={`${health.cpu.cores} cores · 1m avg: ${health.cpu.load_avg_1m}`}
					percent={health.cpu.percent}
					level={health.cpu.level}
					help="Uso de CPU del VPS (promedio 1 min). Procesar telemetría y WebSockets consume CPU. A 50% activar PM2 cluster mode. A 80% upgrade de VPS."
				/>

				<MetricRow
					icon={Cpu}
					label="MQTT Devices"
					value={`${health.mqtt.active_connections}`}
					sublabel={`Warning at ${health.mqtt.warning_threshold}+ · Critical at ${health.mqtt.warning_threshold * 3}`}
					percent={health.mqtt.percent}
					level={health.mqtt.level}
					help="Dispositivos ESP32 activos (publicaron telemetría en los últimos 2 min). Cada uno consume ~50-100 KB de RAM en Mosquitto. Límite real ~5,000."
				/>

				<MetricRow
					icon={Globe}
					label="WebSocket Clients"
					value={`${health.websocket.connected_clients}`}
					sublabel={`Warning at ${health.websocket.warning_threshold}+`}
					percent={health.websocket.percent}
					level={health.websocket.level}
					help="Navegadores con un dashboard abierto ahora mismo (conexiones Socket.io). Cada uno consume ~1-2 MB de RAM. Límite real ~2,000."
				/>
			</div>

			<MetricRow
				icon={Globe}
				label="Multi-Region Readiness"
				value={`${health.multi_region.installers} installers, ${health.multi_region.devices} devices`}
				sublabel={
					health.multi_region.level === "healthy"
						? `VPS único en Europa · OK hasta ${health.multi_region.installers_warning} clientes / ${health.multi_region.devices_warning} dispositivos `
						: health.multi_region.level === "warning"
							? `Clientes en América empiezan a notar latencia · Comprar 2° VPS en US East (~$6/mes) para servirlos más cerca`
							: `Latencia global afecta la experiencia · Desplegar VPS en US East YA para que dispositivos y dashboards en América tengan <50ms`
				}
				percent={
					health.multi_region.level === "critical"
						? 90
						: health.multi_region.level === "warning"
							? 50
							: Math.round(
									(health.multi_region.installers /
										health.multi_region.installers_warning) *
										50,
								)
				}
				level={health.multi_region.level}
				help="El VPS está en Europa. Si tenés clientes en América, los datos cruzan el Atlántico (150-300ms). Con 25+ clientes conviene un 2° VPS en US East ($6/mes) para servir América con <50ms."
			/>

			{/* Largest tables */}
			{health.database.largest_tables.length > 0 && (
				<div className="pt-2 border-t">
					<p className="text-xs font-medium text-muted-foreground mb-2">
						Largest Tables
					</p>
					<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
						{health.database.largest_tables.map((t) => (
							<div
								key={t.table_name}
								className="flex justify-between items-center px-2.5 py-1.5 rounded bg-muted/50 text-xs"
							>
								<span className="truncate font-mono">{t.table_name}</span>
								<span className="ml-2 shrink-0 text-muted-foreground">
									{t.size}
								</span>
							</div>
						))}
					</div>
				</div>
			)}

			<UpgradeGuide alerts={health.alerts} />
		</div>
	);
}
