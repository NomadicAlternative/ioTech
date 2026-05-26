import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string) => fallback ?? key,
	}),
}));

vi.mock("@/i18n/i18n", () => ({
	default: {
		language: "en",
		changeLanguage: vi.fn(),
	},
}));

vi.mock("lucide-react", () => ({
	LayoutDashboard: () => <span data-testid="icon-dashboard" />,
	Cpu: () => <span data-testid="icon-cpu" />,
	FileCode2: () => <span data-testid="icon-filecode" />,
	Users: () => <span data-testid="icon-users" />,
	Settings: () => <span data-testid="icon-settings" />,
	LogOut: () => <span data-testid="icon-logout" />,
	Globe: () => <span data-testid="icon-globe" />,
	ShieldCheck: () => <span data-testid="icon-shield" />,
	Bot: () => <span data-testid="icon-bot" />,
	Download: () => <span data-testid="icon-download" />,
	Cable: () => <span data-testid="icon-cable" />,
	Building2: () => <span data-testid="icon-building" />,
	Menu: () => <span data-testid="icon-menu" />,
	X: () => <span data-testid="icon-x" />,
	Wand2: () => <span data-testid="icon-wand" />,
	BookOpen: () => <span data-testid="icon-book" />,
}));

import { AppShell } from "@/components/AppShell";
import { useAuthStore } from "@/features/auth/authStore";

beforeEach(() => {
	useAuthStore.setState({
		user: null,
		accessToken: null,
		isAuthenticated: false,
		isSuperAdmin: false,
	});
	vi.clearAllMocks();
});

function renderAppShell() {
	return render(
		<MemoryRouter>
			<AppShell />
		</MemoryRouter>,
	);
}

describe("AppShell — mutex navigation (ADMIN-005)", () => {
	it("shows INSTALLER nav items when user is an installer", () => {
		useAuthStore.setState({
			user: {
				id: "u1",
				email: "inst@test.com",
				role: "installer",
				tenantId: "t1",
			},
			accessToken: "tok",
			isAuthenticated: true,
			isSuperAdmin: false,
		});

		renderAppShell();

		// Should see installer nav items (Dashboards, Devices, Rules, etc.)
		expect(screen.getByText("nav.dashboards")).toBeInTheDocument();
		expect(screen.getByText("nav.devices")).toBeInTheDocument();
		expect(screen.getByText("nav.rules")).toBeInTheDocument();
		expect(screen.getByText("nav.templates")).toBeInTheDocument();
		expect(screen.getByText("nav.firmware")).toBeInTheDocument();
		expect(screen.getByText("nav.ai")).toBeInTheDocument();
		expect(screen.getByText("nav.provision")).toBeInTheDocument();
		expect(screen.getByText("nav.clients")).toBeInTheDocument();
		expect(screen.getByText("nav.settings")).toBeInTheDocument();
	});

	it("shows ADMIN nav items when user is super_admin", () => {
		useAuthStore.setState({
			user: {
				id: "u2",
				email: "sa@test.com",
				role: "super_admin",
				tenantId: "sa-t1",
			},
			accessToken: "tok",
			isAuthenticated: true,
			isSuperAdmin: true,
		});

		renderAppShell();

		// Should see admin nav items
		expect(screen.getByText("nav.dashboard")).toBeInTheDocument();
		expect(screen.getByText("nav.installers")).toBeInTheDocument();
	});

	it("does NOT show installer nav items when user is super_admin", () => {
		useAuthStore.setState({
			user: {
				id: "u3",
				email: "sa2@test.com",
				role: "super_admin",
				tenantId: "sa-t2",
			},
			accessToken: "tok",
			isAuthenticated: true,
			isSuperAdmin: true,
		});

		renderAppShell();

		// Should not see installer nav items
		expect(screen.queryByText("nav.dashboards")).not.toBeInTheDocument();
		expect(screen.queryByText("nav.devices")).not.toBeInTheDocument();
		expect(screen.queryByText("nav.rules")).not.toBeInTheDocument();
		expect(screen.queryByText("nav.settings")).not.toBeInTheDocument();
	});

	it("does NOT show admin nav items when user is an installer", () => {
		useAuthStore.setState({
			user: {
				id: "u4",
				email: "inst2@test.com",
				role: "installer",
				tenantId: "t2",
			},
			accessToken: "tok",
			isAuthenticated: true,
			isSuperAdmin: false,
		});

		renderAppShell();

		// Should not see admin nav items
		expect(screen.queryByText("nav.dashboard")).not.toBeInTheDocument();
		expect(screen.queryByText("nav.installers")).not.toBeInTheDocument();
	});

	it("removes old Tenants link in favor of admin nav items", () => {
		useAuthStore.setState({
			user: {
				id: "u5",
				email: "sa3@test.com",
				role: "super_admin",
				tenantId: "sa-t3",
			},
			accessToken: "tok",
			isAuthenticated: true,
			isSuperAdmin: true,
		});

		renderAppShell();

		// The old nav.tenants key should NOT appear (replaced by nav.installers and admin routes)
		expect(screen.queryByText("nav.tenants")).not.toBeInTheDocument();
	});
});
