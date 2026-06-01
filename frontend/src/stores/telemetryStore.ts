import { create } from "zustand";

/**
 * A single telemetry reading — the latest value received for a device:stream key.
 */
interface TelemetryEntry {
	value: unknown;
	ts: number;
}

/**
 * Flat map of telemetry keyed by `"${deviceId}:${datastreamKey}"`.
 * Using a flat key gives O(1) lookup per widget subscription (AD-DASH-006).
 */
interface TelemetryState {
	data: Record<string, TelemetryEntry>;
	/** Monotonic version — increments on every setTelemetry(). Subscribe to this to re-render on any telemetry change. */
	version: number;
}

interface TelemetryActions {
	/** Write or overwrite the latest reading for a device/stream pair. */
	setTelemetry: (
		deviceId: string,
		datastreamKey: string,
		value: unknown,
		ts: number,
	) => void;
	/** Read a single entry by composite key — use `useTelemetryValue` for reactive subscriptions. */
	getTelemetry: (key: string) => TelemetryEntry | undefined;
	/** Clear all telemetry — called on logout. */
	clearAll: () => void;
}

type TelemetryStore = TelemetryState & TelemetryActions;

/**
 * Zustand store for real-time telemetry data.
 * Populated by `SocketProvider` on each incoming `telemetry` Socket.io event.
 *
 * @example
 * const entry = useTelemetryValue('device-id', 'temp')
 */
export const useTelemetryStore = create<TelemetryStore>((set, get) => ({
	data: {},
	version: 0,

	setTelemetry: (deviceId, datastreamKey, value, ts) => {
		const key = `${deviceId}:${datastreamKey}`;
		set((state) => ({
			data: {
				...state.data,
				[key]: { value, ts },
			},
			version: state.version + 1,
		}));
	},

	getTelemetry: (key) => get().data[key],

	clearAll: () => set({ data: {}, version: 0 }),
}));

/**
 * Selector hook — only re-renders when the specific key changes.
 */
export function useTelemetryValue(
	deviceId: string,
	datastreamKey: string,
): TelemetryEntry | undefined {
	const key = `${deviceId}:${datastreamKey}`;
	return useTelemetryStore((state) => state.data[key]);
}

/**
 * Subscribe to the monotonic version counter. Re-renders on any telemetry change.
 * Use in parent components that need to force react-grid-layout re-renders.
 */
export function useTelemetryVersion(): number {
	return useTelemetryStore((state) => state.version);
}
