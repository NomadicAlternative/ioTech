import { useState, useEffect, useMemo } from "react";
import {
	ChevronDown,
	ChevronRight,
	AlertTriangle,
	CheckCircle2,
	Cpu,
	Gauge,
	AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { parseCppCode, type DiagnosticsResult } from "./diagnostics";

interface DiagnosticsPanelProps {
	code: string;
}

type SectionKey = "drivers" | "conflicts" | "rules";

export function DiagnosticsPanel({ code }: DiagnosticsPanelProps) {
	const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
		drivers: true,
		conflicts: true,
		rules: true,
	});

	// Debounced parsing: 300ms after last code change
	const [debouncedCode, setDebouncedCode] = useState(code);
	useEffect(() => {
		const timer = setTimeout(() => setDebouncedCode(code), 300);
		return () => clearTimeout(timer);
	}, [code]);

	const diagnostics = useMemo<DiagnosticsResult>(
		() => parseCppCode(debouncedCode),
		[debouncedCode],
	);

	const toggle = (key: SectionKey) =>
		setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

	const driverCount = diagnostics.drivers.length;
	const conflictCount = diagnostics.conflicts.length;
	const ruleCount = diagnostics.rules.length;
	const hasIssues = conflictCount > 0;

	return (
		<div className="space-y-2 text-xs">
			{/* ── Header with summary status ── */}
			<div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--muted)]/30">
				{hasIssues ? (
					<AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
				) : (
					<CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
				)}
				<span className="font-medium">
					{hasIssues
						? `${conflictCount} conflicto${conflictCount !== 1 ? "s" : ""}`
						: "Sin conflictos"}
				</span>
				<span className="text-muted-foreground">
					· {driverCount} driver{driverCount !== 1 ? "s" : ""} · {ruleCount}{" "}
					regla{ruleCount !== 1 ? "s" : ""}
				</span>
			</div>

			{/* ── Section: Drivers ── */}
			<Section
				icon={Cpu}
				label="Drivers detectados"
				count={driverCount}
				expanded={expanded.drivers}
				onToggle={() => toggle("drivers")}
				hasIssues={false}
			>
				{diagnostics.drivers.length === 0 ? (
					<EmptyHint text="No se detectaron drivers. Agregá DHT22, Relay, BME280, etc." />
				) : (
					<div className="space-y-1.5">
						{diagnostics.drivers.map((d, i) => (
							<div
								key={i}
								className="flex items-center gap-2 px-2 py-1 rounded bg-[var(--muted)]/20"
							>
								<span className="font-medium">{d.model}</span>
								<span className="text-muted-foreground">{d.instance}</span>
								{d.gpio !== undefined && !isNaN(d.gpio) && (
									<Badge
										variant="secondary"
										className="text-[10px] px-1 py-0 h-4 ml-auto"
									>
										GPIO {d.gpio}
									</Badge>
								)}
								{d.i2c_addr && (
									<Badge
										variant="secondary"
										className="text-[10px] px-1 py-0 h-4 ml-auto"
									>
										I2C {d.i2c_addr}
									</Badge>
								)}
								{d.name && (
									<span className="text-muted-foreground ml-1">«{d.name}»</span>
								)}
							</div>
						))}
					</div>
				)}
			</Section>

			{/* ── Section: Pin Conflicts ── */}
			<Section
				icon={AlertCircle}
				label="Conflictos de pines"
				count={conflictCount}
				expanded={expanded.conflicts}
				onToggle={() => toggle("conflicts")}
				hasIssues={conflictCount > 0}
			>
				{diagnostics.conflicts.length === 0 ? (
					<EmptyHint text="Sin conflictos de pines detectados." />
				) : (
					<div className="space-y-1.5">
						{diagnostics.conflicts.map((c, i) => (
							<div
								key={i}
								className="px-2 py-1.5 rounded bg-amber-50 border border-amber-200"
							>
								<div className="flex items-center gap-1.5">
									<AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
									<span className="font-medium text-amber-800">
										GPIO {c.gpio}
									</span>
								</div>
								<div className="text-amber-700 mt-0.5">
									{c.drivers.join(", ")}
								</div>
							</div>
						))}
					</div>
				)}
			</Section>

			{/* ── Section: Rules ── */}
			<Section
				icon={Gauge}
				label="Reglas detectadas"
				count={ruleCount}
				expanded={expanded.rules}
				onToggle={() => toggle("rules")}
				hasIssues={false}
			>
				{diagnostics.rules.length === 0 ? (
					<EmptyHint text="No se detectaron reglas. Agregá bloques if/else en loop()." />
				) : (
					<div className="space-y-1.5">
						{diagnostics.rules.map((r, i) => (
							<div key={i} className="px-2 py-1.5 rounded bg-[var(--muted)]/20">
								<div className="font-medium">
									{r.condition.datastream} {r.condition.operator}{" "}
									{r.condition.value}
								</div>
								<div className="flex flex-wrap gap-1 mt-1">
									{r.actions.map((a, j) => (
										<Badge
											key={j}
											variant="outline"
											className="text-[10px] px-1 py-0 h-4"
										>
											{a.type === "relay"
												? `${a.instance} → ${a.state?.toUpperCase()}`
												: a.type === "buzzer"
													? `${a.instance} 🔊${a.tone}Hz`
													: `${a.instance}`}
										</Badge>
									))}
								</div>
							</div>
						))}
					</div>
				)}
			</Section>
		</div>
	);
}

// ── Collapsible Section Helper ──

function Section({
	icon: Icon,
	label,
	count,
	expanded,
	onToggle,
	hasIssues,
	children,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	count: number;
	expanded: boolean;
	onToggle: () => void;
	hasIssues: boolean;
	children: React.ReactNode;
}) {
	return (
		<div>
			<button
				onClick={onToggle}
				className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-[var(--muted)]/30 transition-colors ${
					hasIssues ? "text-amber-800" : ""
				}`}
			>
				{expanded ? (
					<ChevronDown className="h-3 w-3" />
				) : (
					<ChevronRight className="h-3 w-3" />
				)}
				<Icon
					className={`h-3.5 w-3.5 ${hasIssues ? "text-amber-500" : "text-muted-foreground"}`}
				/>
				<span className="text-xs font-medium">{label}</span>
				<Badge
					variant="secondary"
					className="ml-auto text-[10px] px-1 py-0 h-4"
				>
					{count}
				</Badge>
			</button>
			{expanded && <div className="mt-1 pl-5">{children}</div>}
		</div>
	);
}

function EmptyHint({ text }: { text: string }) {
	return (
		<p className="text-[11px] text-muted-foreground italic px-2 py-1">{text}</p>
	);
}

export default DiagnosticsPanel;
