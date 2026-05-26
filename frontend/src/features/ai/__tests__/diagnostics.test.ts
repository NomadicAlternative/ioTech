import { describe, it, expect } from "vitest";
import { parseCppCode } from "../diagnostics";

const SAMPLE_CODE = `DHT22 dht(32);
BME280 bme(0x76);
Relay riego(23, "Bomba de riego");
Relay ventilador(22, "Ventilador");

void setup() {
  dht.begin();
  bme.begin();
  riego.begin();
  ventilador.begin();
}

void loop() {
  float temp = dht.readTemperature();
  float hum = bme.readHumidity();
  float pres = bme.readPressure();

  if (hum < 30.0) {
    riego.on();
  } else {
    riego.off();
  }

  if (temp > 35.0) {
    ventilador.on();
  }

  delay(2000);
}`;

describe("parseCppCode", () => {
	// ── RED: Driver Detection ──
	it("detects DHT22 declaration with GPIO pin", () => {
		const result = parseCppCode(SAMPLE_CODE);
		const dht = result.drivers.find((d) => d.model === "DHT22");
		expect(dht).toBeDefined();
		expect(dht!.gpio).toBe(32);
		expect(dht!.instance).toBe("dht");
	});

	it("detects BME280 declaration with I2C address", () => {
		const result = parseCppCode(SAMPLE_CODE);
		const bme = result.drivers.find((d) => d.model === "BME280");
		expect(bme).toBeDefined();
		expect(bme!.i2c_addr).toBe("0x76");
		expect(bme!.instance).toBe("bme");
	});

	it("detects Relay declarations with GPIO and name", () => {
		const result = parseCppCode(SAMPLE_CODE);
		const relays = result.drivers.filter((d) => d.model === "Relay");
		expect(relays).toHaveLength(2);

		const riego = relays.find((r) => r.instance === "riego");
		expect(riego).toBeDefined();
		expect(riego!.gpio).toBe(23);
		expect(riego!.name).toBe("Bomba de riego");

		const vent = relays.find((r) => r.instance === "ventilador");
		expect(vent).toBeDefined();
		expect(vent!.gpio).toBe(22);
		expect(vent!.name).toBe("Ventilador");
	});

	// ── RED: Pin Conflict Detection ──
	it("detects GPIO pin conflicts between drivers", () => {
		const conflictCode = `DHT22 dht(21);
BME280 bme(0x76);
Relay test(21, "Conflicto");`;
		const result = parseCppCode(conflictCode);
		expect(result.conflicts.length).toBeGreaterThan(0);
		const gpio21Conflict = result.conflicts.find((c) => c.gpio === 21);
		expect(gpio21Conflict).toBeDefined();
		expect(gpio21Conflict!.drivers.length).toBe(2);
	});

	it("returns empty conflicts when no pin overlap", () => {
		const result = parseCppCode(SAMPLE_CODE);
		expect(result.conflicts).toHaveLength(0);
	});

	// ── RED: Rule Extraction ──
	it("extracts rule conditions from if blocks", () => {
		const result = parseCppCode(SAMPLE_CODE);
		expect(result.rules.length).toBe(2);

		const humRule = result.rules.find(
			(r) => r.condition.datastream === "humidity",
		);
		expect(humRule).toBeDefined();
		expect(humRule!.condition.operator).toBe("<");
		expect(humRule!.condition.value).toBe(30.0);

		const tempRule = result.rules.find(
			(r) => r.condition.datastream === "temperature",
		);
		expect(tempRule).toBeDefined();
		expect(tempRule!.condition.operator).toBe(">");
		expect(tempRule!.condition.value).toBe(35.0);
	});

	it("extracts actions from rule bodies", () => {
		const result = parseCppCode(SAMPLE_CODE);
		const humRule = result.rules.find(
			(r) => r.condition.datastream === "humidity",
		)!;

		const onAction = humRule.actions.find((a) => a.state === "on");
		expect(onAction).toBeDefined();

		const offAction = humRule.actions.find((a) => a.state === "off");
		expect(offAction).toBeDefined();
	});

	// ── RED: Edge Cases ──
	it("handles empty code gracefully", () => {
		const result = parseCppCode("");
		expect(result.drivers).toEqual([]);
		expect(result.conflicts).toEqual([]);
		expect(result.rules).toEqual([]);
	});

	it("handles unparseable code gracefully", () => {
		const result = parseCppCode("esto no es c++ valido {{{");
		expect(result.drivers).toEqual([]);
		expect(result.conflicts).toEqual([]);
		expect(result.rules).toEqual([]);
	});

	it("detects PIR and Buzzer declarations", () => {
		const code = `PIR pir(27);
Buzzer buzzer(13);`;
		const result = parseCppCode(code);
		expect(result.drivers).toHaveLength(2);
		expect(result.drivers[0].model).toBe("PIR");
		expect(result.drivers[0].gpio).toBe(27);
		expect(result.drivers[1].model).toBe("Buzzer");
		expect(result.drivers[1].gpio).toBe(13);
	});

	it("detects HC-SR04 with trigger and echo pins", () => {
		const code = `HC_SR04 sonic(33, 34);`;
		const result = parseCppCode(code);
		const driver = result.drivers[0];
		expect(driver.model).toBe("HC_SR04");
		expect(driver.gpio).toBe(33);
		expect(driver.gpio2).toBe(34);
	});

	it("detects DS18B20 and Servo", () => {
		const code = `DS18B20 ds(4);
Servo servo(26);`;
		const result = parseCppCode(code);
		expect(result.drivers).toHaveLength(2);
		expect(result.drivers[0].model).toBe("DS18B20");
		expect(result.drivers[1].model).toBe("Servo");
	});

	it("detects WS2812B with pin and LED count", () => {
		const code = `WS2812B leds(25, 60);`;
		const result = parseCppCode(code);
		const driver = result.drivers[0];
		expect(driver.model).toBe("WS2812B");
		expect(driver.gpio).toBe(25);
		expect(driver.numLeds).toBe(60);
	});

	it("detects display drivers (SSD1306, LCD1602)", () => {
		const code = `SSD1306 oled(0x3C);
LCD1602 lcd(0x27);`;
		const result = parseCppCode(code);
		expect(result.drivers).toHaveLength(2);
		expect(result.drivers[0].model).toBe("SSD1306");
		expect(result.drivers[0].i2c_addr).toBe("0x3C");
		expect(result.drivers[1].model).toBe("LCD1602");
		expect(result.drivers[1].i2c_addr).toBe("0x27");
	});

	it("detects buzzer beep actions in rules", () => {
		const code = `PIR pir(27);
Buzzer bz(13);

void loop() {
  if (pir.motionDetected() > 0) {
    bz.beep(1000);
  }
}`;
		const result = parseCppCode(code);
		expect(result.rules).toHaveLength(1);
		const buzzerAction = result.rules[0].actions.find(
			(a) => a.type === "buzzer",
		);
		expect(buzzerAction).toBeDefined();
		expect(buzzerAction!.tone).toBe(1000);
	});
});
