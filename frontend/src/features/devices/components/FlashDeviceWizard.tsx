import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ProvisioningModal } from "./ProvisioningModal";
import { flashESP32 } from "@/lib/webSerialFlash";
import {
	CheckCircle2,
	AlertTriangle,
	Loader2,
	Cpu,
	Zap,
	RotateCcw,
	ArrowRight,
} from "lucide-react";

type Phase =
	| "idle"
	| "connecting"
	| "building"
	| "flashing"
	| "reset"
	| "done"
	| "error";

interface Props {
	deviceId: string;
	deviceName: string;
	open: boolean;
	onClose: () => void;
}

export function FlashDeviceWizard({
	deviceId,
	deviceName,
	open,
	onClose,
}: Props) {
	const { t: _t } = useTranslation();
	const [phase, setPhase] = useState<Phase>("idle");
	const [logs, setLogs] = useState<string[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [showProvisioning, setShowProvisioning] = useState(false);
	const logsRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (logsRef.current) {
			logsRef.current.scrollTop = logsRef.current.scrollHeight;
		}
	}, [logs]);

	function reset() {
		setPhase("idle");
		setLogs([]);
		setError(null);
		setShowProvisioning(false);
	}

	function handleClose() {
		if (phase === "building" || phase === "flashing") return;
		reset();
		onClose();
	}

	async function startFlash() {
		setPhase("connecting");
		setLogs([]);
		setError(null);

		// Ask user to select serial port FIRST, before showing terminal
		let port: SerialPort;
		try {
			port = await navigator.serial.requestPort();
		} catch {
			// User cancelled
			setPhase("idle");
			return;
		}

		setPhase("building");

		const success = await flashESP32(
			port,
			"https://iotech-iml4.onrender.com/firmware/flash/esp32dev.bin",
			({ step, line }) => {
				setLogs((prev) => [...prev, line]);
				if (step === "flash") setPhase("flashing");
				if (step === "done") setPhase("reset");
				if (step === "error") {
					setPhase("error");
					setError(line);
				}
			},
		);

		if (!success && phase !== "error") {
			setPhase("error");
			setError("Flash failed");
		}
	}

	return (
		<>
			<Dialog
				open={open && !showProvisioning}
				onOpenChange={(o) => {
					if (!o) handleClose();
				}}
			>
				<DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Zap className="w-5 h-5 text-amber-500" />
							Flash & Provision: {deviceName}
						</DialogTitle>
					</DialogHeader>

					<div className="space-y-6 py-2 min-h-[250px]">
						{/* Idle */}
						{phase === "idle" && (
							<div className="text-center space-y-6 py-8">
								<Cpu className="w-20 h-20 text-muted-foreground mx-auto" />
								<div>
									<h3 className="text-xl font-bold">
										⚡ Flash & Provision — Un click
									</h3>
									<p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
										El ESP32 viene de fábrica sin firmware. Vamos a flashearlo y
										enviarle credenciales WiFi en un solo paso guiado.
									</p>
									<div className="mt-4 space-y-2 text-left max-w-md mx-auto text-sm text-muted-foreground">
										<p>1. 🔌 Conectá el ESP32 a la computadora vía USB</p>
										<p>
											2. ⚡ Click en Start Flash → seleccioná el puerto del
											ESP32
										</p>
										<p>3. ⏳ El firmware se descarga y se flashea (~30s)</p>
										<p>4. 🔄 Apretá EN/RESET cuando aparezca el aviso</p>
										<p>5. 📡 Configurá el WiFi del cliente y provisioná</p>
									</div>
								</div>
								<Button size="lg" onClick={startFlash} className="gap-2">
									<Zap className="w-4 h-4" />
									Start Flash
								</Button>
							</div>
						)}

						{/* Connecting — port selector dialog is open */}
						{phase === "connecting" && (
							<div className="text-center space-y-4 py-12">
								<Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
								<h3 className="text-lg font-semibold">
									Select the ESP32 serial port
								</h3>
								<p className="text-sm text-muted-foreground">
									The browser will show a dialog — select the port that matches
									your ESP32 (usually{" "}
									<code className="bg-muted px-1 rounded">
										/dev/cu.usbserial-*
									</code>{" "}
									on Mac,
									<code className="bg-muted px-1 rounded">COM*</code> on
									Windows)
								</p>
							</div>
						)}

						{/* Building / Flashing */}
						{(phase === "building" || phase === "flashing") && (
							<div className="space-y-3">
								<div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
									<Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
									<div>
										<p className="font-semibold">
											{phase === "building"
												? "🔧 Downloading + flashing firmware..."
												: "⚡ Flashing ESP32..."}
										</p>
										<p className="text-xs text-muted-foreground">
											{phase === "building"
												? "Seleccioná el puerto serial del ESP32 en la ventana del navegador"
												: "No desconectes el USB"}
										</p>
									</div>
								</div>

								{/* Logs */}
								<div
									ref={logsRef}
									className="bg-black/90 text-green-400 rounded-lg p-3 h-48 overflow-y-auto font-mono text-xs whitespace-pre-wrap"
								>
									{logs.length === 0 && (
										<span className="text-green-600">
											Waiting for serial port...
										</span>
									)}
									{logs.map((line, i) => (
										<div key={i}>{line}</div>
									))}
								</div>
							</div>
						)}

						{/* Reset prompt */}
						{phase === "reset" && (
							<div className="text-center space-y-6 py-8">
								<div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
									<div className="flex items-center justify-center gap-3 mb-3">
										<AlertTriangle className="w-8 h-8 text-amber-500" />
										<h3 className="text-lg font-bold text-amber-600">
											⚠️ Presioná EN/RESET en el ESP32
										</h3>
									</div>
									<p className="text-sm text-muted-foreground">
										El ESP32 necesita reiniciarse para arrancar con el nuevo
										firmware. Presioná el botón EN (o RESET) en la placa.
									</p>
								</div>

								<div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
									<CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-2" />
									<p className="font-semibold text-green-600">
										✅ Flash complete!
									</p>
									<div className="mt-2 text-xs text-muted-foreground space-y-1">
										<p>✔ Bootloader escrito</p>
										<p>✔ Firmware escrito</p>
										<p>✔ Tabla de particiones actualizada</p>
									</div>
								</div>

								<Button
									size="lg"
									onClick={() => {
										setShowProvisioning(true);
									}}
									className="gap-2"
								>
									Continue — Configure WiFi
									<ArrowRight className="w-4 h-4" />
								</Button>
							</div>
						)}

						{/* Done (provisioning closed) */}
						{phase === "done" && (
							<div className="text-center space-y-6 py-8">
								<CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
								<h3 className="text-xl font-bold text-green-600">
									🎉 Device Ready!
								</h3>
								<p className="text-sm text-muted-foreground">
									El ESP32 está flasheado y provisionado. Debería aparecer
									online en el dashboard en unos segundos.
								</p>
								<Button
									variant="outline"
									onClick={() => {
										reset();
										onClose();
									}}
								>
									Cerrar
								</Button>
							</div>
						)}

						{/* Error */}
						{phase === "error" && (
							<div className="text-center space-y-6 py-8">
								<AlertTriangle className="w-16 h-16 text-red-500 mx-auto" />
								<h3 className="text-xl font-bold text-red-600">Flash failed</h3>
								{error && (
									<p className="text-sm text-muted-foreground bg-red-500/5 p-3 rounded">
										{error}
									</p>
								)}
								<div className="flex gap-2 justify-center">
									<Button variant="outline" onClick={reset} className="gap-2">
										<RotateCcw className="w-4 h-4" />
										Try Again
									</Button>
									<Button variant="ghost" onClick={handleClose}>
										Close
									</Button>
								</div>
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>

			{/* Provisioning modal — shown after reset prompt */}
			<ProvisioningModal
				deviceId={deviceId}
				deviceName={deviceName}
				open={showProvisioning}
				onClose={() => {
					setShowProvisioning(false);
					setPhase("done");
				}}
			/>
		</>
	);
}
