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
			"Update thresholds in Railway env: DB_SIZE_LIMIT_MB=10000",
		],
		cost: "$19/month",
		downtime: "Zero — Neon migrates live",
		link: "https://console.neon.tech",
	},
	connections: {
		title: "Increase Connection Pool",
		steps: [
			"Go to Railway dashboard → your service → Variables",
			"Change DB_POOL_MAX from 20 to 30",
			"Update thresholds: CONNECTION_WARNING=24, CONNECTION_CRITICAL=28",
			"Redeploy the service (Railway does this automatically on env change)",
		],
		cost: "Free",
		downtime: "~5 seconds (service restart)",
		link: "https://railway.app",
	},
	backend: {
		title: "Scale Backend Memory",
		steps: [
			"Go to Railway dashboard → your service → Settings",
			"Increase Memory from 512 MB to 1 GB",
			"Redeploy the service",
			"If the issue persists, check for memory leaks with node --inspect",
		],
		cost: "~$5/month",
		downtime: "~30 seconds",
		link: "https://railway.app",
	},
	"multi-region": {
		title: "Deploy Multi-Region Infrastructure",
		steps: [
			"Move backend from Railway to Fly.io (deploy to 6 regions with same Docker image)",
			"Move database from Neon to Supabase (add read replicas in US, EU, Asia)",
			"Upgrade MQTT from HiveMQ Free to Starter (multi-region cluster, $9/month)",
			"Update frontend env: VITE_API_URL points to Fly.io load balancer",
			"Re-provision ESP32 devices with new MQTT broker URL (nearest region)",
		],
		cost: "~$34/month total (Fly.io free + Supabase $25 + HiveMQ $9)",
		downtime: "~2 hours planned migration window",
		link: "https://fly.io",
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
