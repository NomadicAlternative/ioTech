import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock("@/features/dashboard/api", () => ({
	sendDeviceCommand: vi.fn(),
}));

// Mock Switch component — renders a checkbox-like button
vi.mock("@/components/ui/switch", () => ({
	Switch: ({
		checked,
		onCheckedChange,
		disabled,
	}: {
		checked: boolean;
		onCheckedChange: (v: boolean) => void;
		disabled?: boolean;
	}) => (
		<button
			role="switch"
			aria-checked={checked}
			disabled={disabled}
			onClick={() => onCheckedChange(!checked)}
			data-testid="toggle-switch"
		>
			{checked ? "ON" : "OFF"}
		</button>
	),
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		onClick,
		disabled,
	}: {
		children: React.ReactNode;
		onClick?: () => void;
		disabled?: boolean;
	}) => (
		<button onClick={onClick} disabled={disabled}>
			{children}
		</button>
	),
}));

vi.mock("@/components/ui/label", () => ({
	Label: ({ children }: { children: React.ReactNode }) => (
		<span>{children}</span>
	),
}));

vi.mock("@/components/ui/input", () => ({
	Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
		<input {...props} />
	),
}));

vi.mock("@/components/ui/select", () => ({
	Select: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SelectTrigger: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SelectValue: () => <span />,
	SelectContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SelectItem: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

import * as dashboardApi from "@/features/dashboard/api";
import { useTelemetryStore } from "@/stores/telemetryStore";
import { ToggleSwitchWidget } from "@/features/widgets/types/ToggleSwitchWidget";
import { ButtonWidget } from "@/features/widgets/types/ButtonWidget";

const makeConfig = (overrides = {}) => ({
	name: "Test Widget",
	deviceId: "device-1",
	datastreamKey: "relay",
	settings: { onCommand: "on", offCommand: "off", onValue: "1" },
	...overrides,
});

describe("ToggleSwitchWidget", () => {
	beforeEach(() => {
		useTelemetryStore.getState().clearAll();
		vi.clearAllMocks();
	});

	it("renders current state from telemetry — OFF when no telemetry", () => {
		render(
			<ToggleSwitchWidget
				widgetId="w1"
				config={makeConfig()}
				isEditing={false}
			/>,
		);

		const sw = screen.getByTestId("toggle-switch");
		expect(sw).toHaveAttribute("aria-checked", "false");
	});

	it("renders ON state when telemetry value matches onValue", () => {
		act(() => {
			useTelemetryStore
				.getState()
				.setTelemetry("device-1", "relay", "1", Date.now());
		});

		render(
			<ToggleSwitchWidget
				widgetId="w1"
				config={makeConfig()}
				isEditing={false}
			/>,
		);

		expect(screen.getByTestId("toggle-switch")).toHaveAttribute(
			"aria-checked",
			"true",
		);
	});

	it("sends POST command on toggle and shows optimistic state immediately", async () => {
		vi.mocked(dashboardApi.sendDeviceCommand).mockImplementation(
			() => new Promise((resolve) => setTimeout(resolve, 100)),
		);

		render(
			<ToggleSwitchWidget
				widgetId="w1"
				config={makeConfig()}
				isEditing={false}
			/>,
		);

		const sw = screen.getByTestId("toggle-switch");
		expect(sw).toHaveAttribute("aria-checked", "false");

		await userEvent.click(sw);

		// Optimistically ON immediately
		expect(screen.getByTestId("toggle-switch")).toHaveAttribute(
			"aria-checked",
			"true",
		);

		await waitFor(() => {
			expect(dashboardApi.sendDeviceCommand).toHaveBeenCalledWith(
				"device-1",
				1,
				"on",
			);
		});
	});

	it("reverts to original state on API error", async () => {
		vi.mocked(dashboardApi.sendDeviceCommand).mockRejectedValueOnce(
			new Error("API error"),
		);

		render(
			<ToggleSwitchWidget
				widgetId="w1"
				config={makeConfig()}
				isEditing={false}
			/>,
		);

		const sw = screen.getByTestId("toggle-switch");
		await userEvent.click(sw);

		// Wait for rejection and revert
		await waitFor(() => {
			expect(screen.getByTestId("toggle-switch")).toHaveAttribute(
				"aria-checked",
				"false",
			);
		});
	});

	it("disables switch when deviceId is empty", () => {
		render(
			<ToggleSwitchWidget
				widgetId="w1"
				config={makeConfig({ deviceId: "" })}
				isEditing={false}
			/>,
		);

		expect(screen.getByTestId("toggle-switch")).toBeDisabled();
	});
});

describe("ButtonWidget", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders with label from config settings", () => {
		render(
			<ButtonWidget
				widgetId="w2"
				config={makeConfig({
					settings: {
						action: "trigger",
						label: "Activate",
						variant: "default",
					},
				})}
				isEditing={false}
			/>,
		);

		expect(screen.getByText("Activate")).toBeInTheDocument();
	});

	it("sends command with configured action on click", async () => {
		vi.mocked(dashboardApi.sendDeviceCommand).mockResolvedValueOnce(undefined);

		render(
			<ButtonWidget
				widgetId="w2"
				config={makeConfig({
					settings: { action: "open", label: "Open Gate", variant: "default" },
				})}
				isEditing={false}
			/>,
		);

		await userEvent.click(screen.getByText("Open Gate"));

		await waitFor(() => {
			expect(dashboardApi.sendDeviceCommand).toHaveBeenCalledWith(
				"device-1",
				1,
				"on",
			);
		});
	});

	it("disables button while command is in flight", async () => {
		vi.mocked(dashboardApi.sendDeviceCommand).mockImplementation(
			() => new Promise((resolve) => setTimeout(resolve, 200)),
		);

		render(
			<ButtonWidget
				widgetId="w2"
				config={makeConfig({
					settings: { action: "trigger", label: "Send", variant: "default" },
				})}
				isEditing={false}
			/>,
		);

		await userEvent.click(screen.getByText("Send"));

		expect(screen.getByText("Sending…")).toBeDisabled();
	});

	it("does not send command when deviceId is empty", async () => {
		render(
			<ButtonWidget
				widgetId="w2"
				config={makeConfig({
					deviceId: "",
					settings: { action: "trigger", label: "Send", variant: "default" },
				})}
				isEditing={false}
			/>,
		);

		// Button is disabled when no deviceId
		expect(screen.getByText("Send")).toBeDisabled();
	});
});
