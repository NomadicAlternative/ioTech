/**
 * Web Serial flash utility — flashes ESP32 firmware using esptool-js.
 * Works cross-platform (Windows, macOS, Linux) on Chrome/Edge.
 */
import { ESPLoader, Transport } from "esptool-js";

export interface FlashProgress {
	step: string;
	line: string;
}

type OnProgress = (event: FlashProgress) => void;

export async function flashESP32(
	firmwareUrl: string,
	onProgress: OnProgress,
): Promise<boolean> {
	let transport: Transport | null = null;

	try {
		// 1. Request serial port (browser dialog)
		onProgress({ step: "connect", line: "🔌 Select the ESP32 serial port in the browser dialog..." });
		let device: SerialPort;
		try {
			device = await navigator.serial.requestPort();
		} catch (err) {
			if (err instanceof DOMException && err.name === "AbortError") {
				onProgress({ step: "cancelled", line: "" });
				return false;
			}
			throw err;
		}

		// 2. Create transport + connect
		onProgress({ step: "connect", line: "🔗 Opening serial port..." });
		transport = new Transport(device);
		await transport.connect(115200);
		onProgress({ step: "connect", line: "✅ Serial port opened" });

		// 3. Create loader
		const loader = new ESPLoader({
			transport,
			baudrate: 115200,
			terminal: {
				clean: () => {},
				writeLine: (line: string) => onProgress({ step: "flash", line }),
				write: (text: string) => onProgress({ step: "flash", line: text }),
			},
		});

		// 4. Connect to ESP32 (detect chip, run stub)
		onProgress({ step: "connect", line: "🔍 Detecting ESP32..." });
		const chip = await loader.main();
		onProgress({ step: "connect", line: `✅ Connected: ${chip}` });

		// 5. Download firmware
		onProgress({ step: "download", line: "📥 Downloading firmware..." });
		const response = await fetch(firmwareUrl);
		if (!response.ok) {
			throw new Error(`Failed to download firmware: HTTP ${response.status}`);
		}
		const firmwareArray = new Uint8Array(await response.arrayBuffer());
		onProgress({
			step: "download",
			line: `✅ Firmware downloaded (${(firmwareArray.length / 1024).toFixed(1)} KB)`,
		});

		// 6. Flash
		onProgress({ step: "flash", line: "⚡ Erasing + writing flash..." });
		await loader.writeFlash({
			fileArray: [{ data: firmwareArray, address: 0x10000 }],
			flashSize: "2MB",
			flashMode: "dio",
			flashFreq: "40m",
			eraseAll: false,
			compress: true,
		});

		onProgress({ step: "done", line: "✅ Flash complete!" });
		await transport.disconnect();
		return true;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		onProgress({ step: "error", line: `❌ ${message}` });
		if (transport) {
			try { await transport.disconnect(); } catch { /* ignore */ }
		}
		return false;
	}
}
