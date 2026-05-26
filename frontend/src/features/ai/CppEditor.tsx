import { useState, useCallback } from "react";
import Editor, { DiffEditor } from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import {
	Loader2,
	Rocket,
	RefreshCw,
	Wand2,
	Check,
	X,
	MessageSquare,
} from "lucide-react";
import api from "@/lib/axios";

interface CppEditorProps {
	code: string;
	onChange: (code: string) => void;
	onSync: () => Promise<unknown>;
	onApply: () => void;
	isDirty: boolean;
	source: string;
}

export function CppEditor({
	code,
	onChange,
	onSync,
	onApply,
	isDirty,
	source,
}: CppEditorProps) {
	const [syncing, setSyncing] = useState(false);
	const [applying, setApplying] = useState(false);
	const [syncError, setSyncError] = useState<string | null>(null);
	// Chat editing state
	const [chatPrompt, setChatPrompt] = useState("");
	const [chatLoading, setChatLoading] = useState(false);
	const [diffCode, setDiffCode] = useState<string | null>(null);
	const [chatError, setChatError] = useState<string | null>(null);

	const handleSync = useCallback(async () => {
		setSyncing(true);
		setSyncError(null);
		try {
			await onSync();
		} catch {
			setSyncError("Error al sincronizar el código");
		} finally {
			setSyncing(false);
		}
	}, [onSync]);

	const handleApply = useCallback(async () => {
		if (isDirty) {
			await handleSync();
		}
		setApplying(true);
		try {
			await onApply();
		} finally {
			setApplying(false);
		}
	}, [isDirty, handleSync, onApply]);

	const handleChatSubmit = useCallback(async () => {
		if (!chatPrompt.trim() || chatLoading) return;
		setChatLoading(true);
		setChatError(null);
		setDiffCode(null);
		try {
			const res = await api.post("/api/ai/configure", {
				prompt: `Edita este código C++ de iotech según la instrucción: "${chatPrompt.trim()}".\n\nCódigo actual:\n${code}\n\nDevuelve SOLO el código C++ completo modificado en el campo "code".`,
			});
			const newCode = res.data?.data?.code;
			if (newCode) {
				setDiffCode(newCode);
			} else {
				setChatError("La IA no pudo generar cambios");
			}
		} catch {
			setChatError("Error al comunicarse con la IA");
		} finally {
			setChatLoading(false);
		}
	}, [chatPrompt, chatLoading]);

	const handleApproveDiff = useCallback(() => {
		if (diffCode) {
			onChange(diffCode);
			setDiffCode(null);
			setChatPrompt("");
			// Auto-sync to update template, drivers, and diagram in parent
			onSync().catch(() => {});
		}
	}, [diffCode, onChange, onSync]);

	const handleRejectDiff = useCallback(() => {
		setDiffCode(null);
		setChatPrompt("");
	}, []);

	return (
		<div className="space-y-3">
			{/* Monaco Editor */}
			<div className="rounded-lg border border-[var(--border)] overflow-hidden">
				<Editor
					height="640px"
					language="cpp"
					theme="vs-dark"
					value={code}
					onChange={(value) => onChange(value || "")}
					options={{
						minimap: { enabled: false },
						fontSize: 13,
						lineNumbers: "on",
						wordWrap: "on",
						scrollBeyondLastLine: false,
						tabSize: 4,
					}}
					loading={
						<div className="flex items-center justify-center h-[640px] text-muted-foreground">
							<Loader2 className="h-5 w-5 animate-spin mr-2" />
							Cargando editor...
						</div>
					}
				/>
			</div>

			{/* Action bar */}
			<div className="flex items-center gap-3">
				<Button
					variant="outline"
					onClick={handleSync}
					disabled={syncing || !isDirty}
					className="gap-1.5"
				>
					{syncing ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<RefreshCw className="h-4 w-4" />
					)}
					{syncing ? "Sincronizando…" : "Sincronizar"}
				</Button>

				<Button onClick={handleApply} disabled={applying} className="gap-1.5">
					{applying ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Rocket className="h-4 w-4" />
					)}
					{applying ? "Aplicando…" : "Aplicar configuración"}
				</Button>

				{isDirty && (
					<span className="text-xs text-amber-600">Código modificado</span>
				)}

				<span className="ml-auto text-xs text-muted-foreground">
					Generado con:{" "}
					{source === "ai"
						? "🤖 IA"
						: source === "regex-fallback"
							? "📋 Motor de reglas"
							: "📋 Motor de reglas"}
				</span>
			</div>

			{syncError && <div className="text-xs text-destructive">{syncError}</div>}

			{/* ── Chat Editing Bar ── */}
			<div className="border-t border-[var(--border)] pt-3">
				<div className="flex items-center gap-1 mb-2">
					<MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
					<span className="text-xs font-medium text-muted-foreground">
						Editar con IA
					</span>
				</div>

				{/* Diff view */}
				{diffCode ? (
					<div className="space-y-2">
						<div
							className="rounded-lg border border-[var(--border)] overflow-hidden"
							style={{ height: "200px" }}
						>
							<DiffEditor
								height="200px"
								language="cpp"
								theme="vs-dark"
								original={code}
								modified={diffCode}
								options={{
									minimap: { enabled: false },
									fontSize: 12,
									lineNumbers: "on",
									wordWrap: "on",
									scrollBeyondLastLine: false,
									readOnly: true,
								}}
							/>
						</div>
						<div className="flex gap-2">
							<Button size="sm" onClick={handleApproveDiff} className="gap-1">
								<Check className="h-3.5 w-3.5" />
								Aplicar cambios
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={handleRejectDiff}
								className="gap-1"
							>
								<X className="h-3.5 w-3.5" />
								Descartar
							</Button>
						</div>
					</div>
				) : (
					<div className="flex gap-2">
						<input
							value={chatPrompt}
							onChange={(e) => setChatPrompt(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && handleChatSubmit()}
							placeholder='"Cambiá el relay 1 al GPIO 19" o "Agregá un buzzer en GPIO 13"'
							className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
						/>
						<Button
							size="sm"
							onClick={handleChatSubmit}
							disabled={chatLoading || !chatPrompt.trim()}
						>
							{chatLoading ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : (
								<Wand2 className="h-3.5 w-3.5" />
							)}
						</Button>
					</div>
				)}

				{chatError && (
					<div className="text-xs text-destructive mt-1">{chatError}</div>
				)}
			</div>
		</div>
	);
}

export default CppEditor;
