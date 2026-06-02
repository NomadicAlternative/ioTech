import { ExternalLink, ArrowUpCircle } from "lucide-react";
import type { HealthAlert } from "./adminApi";

interface UpgradeGuideProps {
	alerts: HealthAlert[];
}

const UPGRADE_STEPS: Record<
	string,
	{
		title: string;
		steps: string[];
		cost: string;
		downtime: string;
		link?: string;
	}
> = {
	database: {
		title: "Upgrade Neon Database",
		steps: [
			"Go to console.neon.tech → your project → Settings",
			'Click "Change plan" → select "Scale" ($19/month)',
			"Storage increases to 10 GB — your data stays intact",
			"Update thresholds in VPS env: DB_SIZE_LIMIT_MB=10000",
		],
		cost: "$19/month",
		downtime: "Zero — Neon migrates live",
		link: "https://console.neon.tech",
	},
	connections: {
		title: "Increase Connection Pool",
		steps: [
			"SSH into VPS: ssh iotech@72.62.191.168",
			"Edit /home/iotech/.env: DB_POOL_MAX=50",
			"Redeploy: cd /home/iotech && docker compose down && docker compose up -d",
			"Update thresholds: CONNECTION_WARNING=60, CONNECTION_CRITICAL=100",
		],
		cost: "Free",
		downtime: "~5 seconds (Docker restart)",
	},
	backend: {
		title: "Scale Backend on VPS",
		steps: [
			"Option A: Enable PM2 cluster mode (uses both CPU cores) — free",
			"Option B: Upgrade VPS from KVM 2 to KVM 4 in Hostinger panel — $11/month",
			"KVM 4 gives 4 vCPU + 16 GB RAM, enough for 500+ devices",
			"Redeploy after upgrade: cd /home/iotech && docker compose up -d --build",
		],
		cost: "Free (PM2) or $11/month (KVM 4)",
		downtime: "~30 seconds (Docker restart)",
		link: "https://hpanel.hostinger.com",
	},
	"multi-region": {
		title: "Deploy Multi-Region Infrastructure",
		steps: [
			"Deploy a second VPS (KVM 2) in a different region (e.g., US East)",
			"Run Mosquitto MQTT on the new VPS with TLS",
			"Point devices to the nearest broker via DNS (mqtt-us.beepdash.com)",
			"Run backend on both VPS behind Cloudflare Load Balancer (free tier)",
			"Neon DB already supports read replicas across regions",
		],
		cost: "~$12/month per additional VPS region",
		downtime: "~2 hours planned migration window",
		link: "https://www.hostinger.com/vps",
	},
};

export function UpgradeGuide({ alerts }: UpgradeGuideProps) {
	if (alerts.length === 0) return null;

	// Show guides for each alerted metric (deduplicated)
	const seen = new Set<string>();
	const guides = alerts
		.filter((a) => {
			if (seen.has(a.metric)) return false;
			seen.add(a.metric);
			return a.metric in UPGRADE_STEPS;
		})
		.map((a) => ({
			alert: a,
			guide: UPGRADE_STEPS[a.metric as keyof typeof UPGRADE_STEPS],
		}));

	if (guides.length === 0) return null;

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<ArrowUpCircle className="w-4 h-4 text-amber-500" />
				<h3 className="text-sm font-semibold">Upgrade Required</h3>
			</div>

			{guides.map(({ alert, guide }) => (
				<div
					key={alert.metric}
					className={`rounded-lg border p-4 ${
						alert.level === "critical"
							? "border-red-200 bg-red-500/5"
							: "border-amber-200 bg-amber-500/5"
					}`}
				>
					<div className="flex items-start justify-between mb-3">
						<div>
							<p className="text-sm font-medium">{guide.title}</p>
							<p className="text-xs text-muted-foreground mt-0.5">
								{alert.message}
							</p>
						</div>
						<span
							className={`text-xs font-medium px-2 py-0.5 rounded-full ${
								alert.level === "critical"
									? "bg-red-500/10 text-red-600"
									: "bg-amber-500/10 text-amber-600"
							}`}
						>
							{alert.level}
						</span>
					</div>

					<ol className="space-y-1.5 mb-3">
						{guide.steps.map((step, i) => (
							<li key={i} className="flex items-start gap-2 text-xs">
								<span className="text-muted-foreground font-mono mt-0.5">
									{i + 1}.
								</span>
								<span>{step}</span>
							</li>
						))}
					</ol>

					<div className="flex items-center gap-3 text-xs">
						<span className="text-muted-foreground">
							Cost: <span className="font-medium">{guide.cost}</span>
						</span>
						<span className="text-muted-foreground">
							Downtime: <span className="font-medium">{guide.downtime}</span>
						</span>
						{guide.link && (
							<a
								href={guide.link}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 text-blue-600 hover:underline ml-auto"
							>
								Open <ExternalLink className="w-3 h-3" />
							</a>
						)}
					</div>
				</div>
			))}
		</div>
	);
}
