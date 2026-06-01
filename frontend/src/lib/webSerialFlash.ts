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

/**
 * Flash an ESP32 via Web Serial API.
 * @param firmwareUrl — URL to the firmware .bin file (e.g., /firmware/flash/esp32dev.bin)
 * @param onProgress — callback for progress updates
 * @returns true on success
 */
export async function flashESP32(
	firmwareUrl: string,
	onProgress: OnProgress,
): Promise<boolean> {
	try {
		// 1. Request serial port
		onProgress({ step: "connect", line: "🔌 Select the ESP32 serial port..." });
		let port: SerialPort;
		try {
				port = await navigator.serial.requestPort();
		} catch (err) {
				// User cancelled port selection — silently abort, not an error
				if (err instanceof DOMException && err.name === "AbortError") {
						onProgress({ step: "cancelled", line: "" });
						return false;
				}
				throw err;
		}
		await port.open({ baudRate: 115200 });

		onProgress({ step: "connect", line: "✅ Serial port opened" });

		// 2. Create transport + loader
		const transport = new Transport(port);
		const loader = new ESPLoader({
			transport,
			baudrate: 115200,
			terminal: {
				clean: () => {},
				writeLine: (line: string) => onProgress({ step: "flash", line }),
				write: (text: string) => onProgress({ step: "flash", line: text }),
			},
		});

		// 3. Connect to ESP32
		onProgress({ step: "connect", line: "🔍 Connecting to ESP32..." });
		const chip = await loader.main();
		onProgress({ step: "connect", line: `✅ Connected: ${chip}` });

		// 4. Download firmware
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

		// 5. Flash
		onProgress({ step: "flash", line: "⚡ Flashing..." });
		await loader.writeFlash({
			fileArray: [{ data: firmwareArray, address: 0x10000 }],
			flashSize: "4MB",
			flashMode: "dio",
			flashFreq: "40m",
			eraseAll: false,
			compress: true,
		});

		onProgress({
			step: "done",
			line: "✅ Flash complete! ESP32 is rebooting...",
		});

		await port.close();
		return true;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		onProgress({ step: "error", line: `❌ ${message}` });
		return false;
	}
}
