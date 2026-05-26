import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { DeviceDetailPage } from "../DeviceDetailPage";
import * as deviceApi from "../api";
import { useDeviceStore } from "../deviceStore";
import { useFirmwareStore } from "@/features/firmware/firmwareStore";
import type { Device, DeviceTemplate } from "@/features/widgets/types";
import type { FirmwareVersion } from "@/features/firmware/types";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const map: Record<string, string> = {
				"devices.detail.backButton": "Back",
				"devices.status.online": "Online",
				"devices.status.offline": "Offline",
				"devices.detail.errorLoad": "Error loading device",
				"devices.detail.notFound": "Device not found",
				"devices.detail.lastSeen": "Last seen: {{date}}",
				"devices.detail.cardId": "Device ID",
				"devices.detail.cardTemplate": "Template",
				"devices.detail.cardCreated": "Created",
				"devices.detail.datastreamTitle": "Datastreams",
				"devices.detail.dsColKey": "Key",
				"devices.detail.dsColName": "Name",
				"devices.detail.dsColType": "Type",
				"devices.detail.dsColUnit": "Unit",
				"devices.detail.metadataTitle": "Metadata",
				"devices.ota.title": "Update Firmware",
				"devices.ota.noFirmwareVersion": "—",
				"common.back": "Back",
				"common.cancel": "Cancel",
				"devices.ota.selectVersion": "Select Version",
				"devices.ota.selectPlaceholder": "Choose a version...",
				"devices.ota.releaseNotes": "Release Notes",
				"devices.ota.confirm": "Update Firmware",
				"devices.ota.triggered": "OTA triggered successfully",
				"devices.ota.noVersions": "No firmware versions available",
				"devices.ota.noHardwareModel": "Cannot resolve firmware target",
				"devices.ota.unknownError": "Unknown error",
				"common.close": "Close",
				"common.sending": "Sending...",
			};
			return map[key] ?? key;
		},
	}),
}));

vi.mock("../api", () => ({
	getDevice: vi.fn(),
	fetchDeviceTemplate: vi.fn(),
	getProvisioningCredentials: vi.fn(),
}));

vi.mock("@/features/firmware/firmwareApi", () => ({
	triggerOta: vi.fn(),
}));

vi.mock("@/features/firmware/firmwareStore", () => {
	const { create } = require("zustand");
	const store = create(() => ({
		firmwareList: [],
		loading: false,
		error: null,
		fetchFirmwareList: vi.fn(),
	}));
	return { useFirmwareStore: store };
});

vi.mock("@/lib/axios", () => ({
	default: {
		post: vi.fn(),
		get: vi.fn(),
	},
}));

vi.mock("../components/ProvisioningModal", () => ({
	ProvisioningModal: () => null,
}));

vi.mock("../components/FlashDeviceWizard", () => ({
	FlashDeviceWizard: () => null,
}));

vi.mock("@/features/auth/authStore", () => {
	const { create } = require("zustand");
	const store = create(() => ({
		user: {
			id: "user-1",
			email: "admin@test.com",
			role: "admin",
			tenantId: "tenant-1",
		},
		accessToken: "mock-token",
		isAuthenticated: true,
		isSuperAdmin: false,
	}));
	return { useAuthStore: store };
});

vi.mock("@/components/ui/dialog", () => ({
	Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
		open ? <div role="dialog">{children}</div> : null,
	DialogContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DialogHeader: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DialogTitle: ({ children }: { children: React.ReactNode }) => (
		<h2>{children}</h2>
	),
	DialogDescription: ({ children }: { children: React.ReactNode }) => (
		<p>{children}</p>
	),
	DialogFooter: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
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

vi.mock("@/components/ui/badge", () => ({
	Badge: ({
		children,
		className,
		style,
	}: {
		children: React.ReactNode;
		className?: string;
		style?: React.CSSProperties;
	}) => (
		<span data-testid="badge" className={className} style={style}>
			{children}
		</span>
	),
}));

vi.mock("@/components/ui/switch", () => ({
	Switch: () => null,
}));

vi.mock("@/components/ui/label", () => ({
	Label: ({ children }: { children: React.ReactNode }) => (
		<label>{children}</label>
	),
}));

vi.mock("@/components/ui/card", () => ({
	Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	CardContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	CardHeader: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	CardTitle: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/ui/select", () => ({
	Select: ({
		value,
		onValueChange,
		children,
	}: {
		value?: string;
		onValueChange?: (v: string) => void;
		children: React.ReactNode;
	}) => (
		<div data-testid="select-wrapper">
			<select
				data-testid="firmware-select"
				value={value ?? ""}
				onChange={(e) => onValueChange?.(e.target.value)}
			>
				<option value="" disabled>
					Choose a version...
				</option>
				{children}
			</select>
		</div>
	),
	SelectTrigger: ({ children }: { children: React.ReactNode }) => (
		<span>{children}</span>
	),
	SelectValue: ({ placeholder }: { placeholder?: string }) => (
		<span>{placeholder}</span>
	),
	SelectContent: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
	SelectItem: ({
		value,
		children,
	}: {
		value: string;
		children: React.ReactNode;
	}) => <option value={value}>{children}</option>,
}));

const mockApi = vi.mocked(deviceApi);

const ONLINE_DEVICE: Device = {
	id: "device-1",
	name: "Test Device",
	templateId: "template-1",
	clientId: null,
	status: "online",
	isOnline: true,
	lastSeen: new Date().toISOString(),
	firmwareVersion: "2.0.0",
	metadata: null,
	createdAt: "2025-01-01T00:00:00Z",
	updatedAt: "2025-01-01T00:00:00Z",
};

const TEMPLATE: DeviceTemplate = {
	id: "template-1",
	name: "ESP32-DevKitC",
	hardware_model: "esp32-devkit",
	datastreams: [],
};

const FIRMWARE_LIST: FirmwareVersion[] = [
	{
		id: "fw-1",
		tenant_id: "tenant-1",
		version: "2.1.0",
		hardware_model: "ESP32-DevKitC",
		release_notes: "Bug fixes",
		download_url: "https://example.com/fw.bin",
		created_at: "2025-01-01T00:00:00Z",
		updated_at: "2025-01-01T00:00:00Z",
	},
];

function resetStores() {
	useDeviceStore.setState({
		devices: [],
		currentDevice: null,
		pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
		search: "",
	});
	useFirmwareStore.setState({
		firmwareList: [],
		loading: false,
		error: null,
	});
}

function renderPage() {
	return render(
		<MemoryRouter initialEntries={["/app/devices/device-1"]}>
			<Routes>
				<Route path="/app/devices/:id" element={<DeviceDetailPage />} />
			</Routes>
		</MemoryRouter>,
	);
}

describe("DeviceDetailPage - firmware badge", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetStores();
	});

	it("shows firmware version badge next to device name", async () => {
		mockApi.getDevice.mockResolvedValue(ONLINE_DEVICE);
		mockApi.fetchDeviceTemplate.mockResolvedValue(TEMPLATE);

		renderPage();

		await waitFor(() => {
			expect(screen.getByText("Test Device")).toBeInTheDocument();
		});

		// Should show the firmware version badge
		expect(screen.getByText("2.0.0")).toBeInTheDocument();
	});

	it("shows em dash when device has no firmware version", async () => {
		const deviceNoFw = { ...ONLINE_DEVICE, firmwareVersion: null };
		mockApi.getDevice.mockResolvedValue(deviceNoFw);
		mockApi.fetchDeviceTemplate.mockResolvedValue(TEMPLATE);

		renderPage();

		await waitFor(() => {
			expect(screen.getByText("Test Device")).toBeInTheDocument();
		});

		expect(screen.getByText("\u2014")).toBeInTheDocument();
	});

	it("shows OTA trigger button when device has firmware version", async () => {
		// Pre-populate the device store so currentDevice is immediately available
		// This avoids the async fetchDevice → setCurrentDevice race.
		useDeviceStore.setState({
			currentDevice: ONLINE_DEVICE,
		});
		mockApi.getDevice.mockResolvedValue(ONLINE_DEVICE);
		mockApi.fetchDeviceTemplate.mockResolvedValue(TEMPLATE);

		renderPage();

		// Check for the Upload icon button — the OTA trigger
		// Must waitFor since fetchDeviceTemplate is async (separate useEffect)
		await waitFor(() => {
			expect(mockApi.fetchDeviceTemplate).toHaveBeenCalledWith("template-1");
		});
		await waitFor(
			() => {
				expect(screen.getByText("Update Firmware")).toBeInTheDocument();
			},
			{ timeout: 3000 },
		);
	});
});
