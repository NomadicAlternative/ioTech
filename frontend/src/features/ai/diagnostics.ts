/**
 * Client-side C++ code diagnostics parser.
 * Runs pure regex — no API call needed. Under 50ms for typical code.
 */

export interface DriverEntry {
	model: string;
	instance: string;
	gpio?: number;
	gpio2?: number;
	i2c_addr?: string;
	name?: string;
	channelNum?: number;
	numLeds?: number;
}

export interface PinConflict {
	gpio: number;
	drivers: string[];
}

export interface RuleAction {
	type: string;
	instance: string;
	state?: string;
	tone?: number;
}

export interface RuleEntry {
	condition: {
		datastream: string;
		operator: string;
		value: number;
	};
	actions: RuleAction[];
}

export interface DiagnosticsResult {
	drivers: DriverEntry[];
	conflicts: PinConflict[];
	rules: RuleEntry[];
}

const DRIVER_CLASSES = [
	"DHT22",
	"BME280",
	"Relay",
	"PIR",
	"HC_SR04",
	"Buzzer",
	"SSD1306",
	"LCD1602",
	"WS2812B",
	"Servo",
	"DS18B20",
];

// Map method names to datastream keys
const METHOD_KEY_MAP: Record<string, string> = {
	readTemperature: "temperature",
	readHumidity: "humidity",
	readPressure: "pressure",
	motionDetected: "motion",
	readDistance: "distance",
};

// Map common variable names to datastream keys (for user-written code)
const VARIABLE_KEY_MAP: Record<string, string> = {
	temp: "temperature",
	hum: "humidity",
	pres: "pressure",
	distance: "distance",
	motion: "motion",
};

/**
 * Parse C++ code and extract drivers, pin conflicts, and rules.
 * Runs synchronously — should complete in <10ms.
 */
export function parseCppCode(code: string): DiagnosticsResult {
	const drivers = extractDrivers(code);
	const conflicts = detectConflicts(drivers);
	const rules = extractRules(code);
	return { drivers, conflicts, rules };
}

function extractDrivers(code: string): DriverEntry[] {
	const results: DriverEntry[] = [];
	const classPattern = new RegExp(
		`(${DRIVER_CLASSES.join("|")})\\s+(\\w+)\\s*\\(([^)]*)\\)`,
		"g",
	);

	let match;
	while ((match = classPattern.exec(code)) !== null) {
		const [, model, instance, argsStr] = match;
		const args = argsStr
			.split(",")
			.map((s) => s.trim().replace(/^["']|["']$/g, ""))
			.filter((s) => s.length > 0);

		const entry: DriverEntry = { model, instance };

		if (
			model === "DHT22" ||
			model === "PIR" ||
			model === "Buzzer" ||
			model === "Servo" ||
			model === "DS18B20"
		) {
			entry.gpio = parseInt(args[0], 10);
		} else if (
			model === "BME280" ||
			model === "SSD1306" ||
			model === "LCD1602"
		) {
			entry.i2c_addr = args[0] || undefined;
		} else if (model === "HC_SR04") {
			entry.gpio = parseInt(args[0], 10);
			entry.gpio2 = args[1] ? parseInt(args[1], 10) : undefined;
		} else if (model === "Relay") {
			entry.gpio = parseInt(args[0], 10);
			entry.name =
				args[1] ||
				`Relay ${results.filter((d) => d.model === "Relay").length + 1}`;
			entry.channelNum = results.filter((d) => d.model === "Relay").length + 1;
		} else if (model === "WS2812B") {
			entry.gpio = parseInt(args[0], 10);
			entry.numLeds = args[1] ? parseInt(args[1], 10) : undefined;
		}

		results.push(entry);
	}

	return results;
}

function detectConflicts(drivers: DriverEntry[]): PinConflict[] {
	const pinUsage: Record<number, string[]> = {};
	for (const d of drivers) {
		if (d.gpio !== undefined && !isNaN(d.gpio)) {
			if (!pinUsage[d.gpio]) pinUsage[d.gpio] = [];
			pinUsage[d.gpio].push(`${d.model} (${d.instance})`);
		}
	}

	const conflicts: PinConflict[] = [];
	for (const [gpio, users] of Object.entries(pinUsage)) {
		if (users.length > 1) {
			conflicts.push({ gpio: parseInt(gpio), drivers: users });
		}
	}
	return conflicts;
}

function extractRules(code: string): RuleEntry[] {
	const rules: RuleEntry[] = [];
	// Match if (instance.method() operator value) { body }
	const ifBlockRe =
		/if\s*\(\s*((\w+)\.(\w+)\(\)|(\w+))\s*([<>=!]+)\s*([\d.]+)\s*\)\s*\{([\s\S]*?)\}\s*(?:else\s*\{([\s\S]*?)\}\s*)?/g;

	let match;
	while ((match = ifBlockRe.exec(code)) !== null) {
		const [, , _instance, method, variable, operator, value, ifBody, elseBody] =
			match;
		const dsKey = method
			? METHOD_KEY_MAP[method] || method
			: VARIABLE_KEY_MAP[variable] || variable;

		const actions: RuleAction[] = [];

		// .on() calls
		const onRe = /(\w+)\.on\(\)/g;
		let am;
		while ((am = onRe.exec(ifBody)) !== null) {
			actions.push({ type: "relay", instance: am[1], state: "on" });
		}

		// .off() calls
		const offRe = /(\w+)\.off\(\)/g;
		while ((am = offRe.exec(ifBody)) !== null) {
			actions.push({ type: "relay", instance: am[1], state: "off" });
		}

		// .beep(freq) calls
		const beepRe = /(\w+)\.beep\((\d+)/g;
		while ((am = beepRe.exec(ifBody)) !== null) {
			actions.push({
				type: "buzzer",
				instance: am[1],
				tone: parseInt(am[2], 10),
			});
		}

		if (elseBody) {
			const elseActions: RuleAction[] = [];
			const elseOnRe = /(\w+)\.on\(\)/g;
			let eam;
			while ((eam = elseOnRe.exec(elseBody)) !== null) {
				elseActions.push({ type: "relay", instance: eam[1], state: "on" });
			}
			const elseOffRe = /(\w+)\.off\(\)/g;
			while ((eam = elseOffRe.exec(elseBody)) !== null) {
				elseActions.push({ type: "relay", instance: eam[1], state: "off" });
			}
			if (elseActions.length > 0) {
				actions.push(...elseActions);
			}
		}

		rules.push({
			condition: {
				datastream: dsKey,
				operator,
				value: parseFloat(value),
			},
			actions,
		});
	}

	return rules;
}
