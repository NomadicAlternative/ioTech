import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
	Cpu,
	Wifi,
	LayoutDashboard,
	Zap,
	ArrowRight,
	CheckCircle2,
	ChevronDown,
	Globe,
	Shield,
	BarChart3,
	RefreshCw,
} from "lucide-react";
import logo from "@/assets/logoprincipal.JPG";

const LANGS = [
	{ code: "en", label: "EN", flag: "🇬🇧" },
	{ code: "es", label: "ES", flag: "🇪🇸" },
	{ code: "de", label: "DE", flag: "🇩🇪" },
	{ code: "pt", label: "PT", flag: "🇧🇷" },
	{ code: "fr", label: "FR", flag: "🇫🇷" },
	{ code: "it", label: "IT", flag: "🇮🇹" },
];

function scrollTo(id: string) {
	document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export function LandingPage() {
	const { t, i18n } = useTranslation();
	const [langOpen, setLangOpen] = useState(false);
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 20);
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const valueProps = [
		{
			icon: Cpu,
			title: "Connect devices instantly",
			desc: "Flash firmware via USB and start receiving data in seconds.",
		},
		{
			icon: Zap,
			title: "Real-time control",
			desc: "Manage sensors, relays and actuators from anywhere in the world.",
		},
		{
			icon: Shield,
			title: "Built to scale",
			desc: "Multi-tenant architecture ready for thousands of devices and installers.",
		},
	];

	const features = [
		{ icon: Cpu, label: "11+ sensors supported" },
		{ icon: Zap, label: "Relays & actuators" },
		{ icon: RefreshCw, label: "Automatic rules" },
		{ icon: BarChart3, label: "Professional dashboard" },
		{ icon: Wifi, label: "OTA firmware updates" },
		{ icon: Shield, label: "Secure by default" },
	];

	const currentLang = LANGS.find(
		(l) => l.code === (i18n.language?.split("-")[0] || "en"),
	);

	return (
		<div className="min-h-screen bg-[var(--prussian-blue)] text-white overflow-x-hidden">
			{/* ─── NAVBAR ─── */}
			<nav
				className={`fixed top-0 w-full z-50 transition-all duration-300 ${
					scrolled
						? "bg-[var(--prussian-blue)]/95 backdrop-blur-xl border-b border-white/5 shadow-lg shadow-black/20"
						: "bg-transparent"
				}`}
			>
				<div className="max-w-7xl mx-auto px-4 md:px-6 h-[72px] md:h-[80px] flex items-center justify-between">
					<img
						src={logo}
						alt="ioTech"
						className="h-[130px] md:h-[180px] w-auto -my-4"
					/>
					<div className="hidden md:flex items-center gap-6 text-sm text-white/60">
						<button
							onClick={() => scrollTo("how")}
							className="hover:text-white transition-colors"
						>
							{t("landing.nav.how")}
						</button>
						<button
							onClick={() => scrollTo("features")}
							className="hover:text-white transition-colors"
						>
							{t("landing.nav.features")}
						</button>
						<button
							onClick={() => scrollTo("pricing")}
							className="hover:text-white transition-colors"
						>
							{t("landing.nav.pricing")}
						</button>
					</div>
					<div className="flex items-center gap-3">
						<div className="relative">
							<button
								onClick={() => setLangOpen(!langOpen)}
								className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white px-3 py-2 rounded-xl hover:bg-white/5 transition-colors"
							>
								<Globe className="h-3.5 w-3.5" />
								<span className="hidden sm:inline">{currentLang?.flag}</span>
								<span>{currentLang?.label || "EN"}</span>
								<ChevronDown className="h-3 w-3" />
							</button>
							{langOpen && (
								<div className="absolute top-full right-0 mt-2 bg-[#141B2D] border border-white/10 rounded-2xl p-1.5 shadow-2xl shadow-black/50 z-50 min-w-[120px]">
									{LANGS.map((l) => (
										<button
											key={l.code}
											onClick={() => {
												i18n.changeLanguage(l.code);
												setLangOpen(false);
											}}
											className={`flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${
												(i18n.language?.split("-")[0] || "en") === l.code
													? "bg-[var(--orange)]/15 text-[var(--orange)]"
													: "text-white/60 hover:text-white hover:bg-white/5"
											}`}
										>
											<span>{l.flag}</span>
											<span>{l.label}</span>
										</button>
									))}
								</div>
							)}
						</div>
						<a
							href="/login"
							className="hidden sm:inline text-sm text-white/60 hover:text-white transition-colors"
						>
							{t("landing.nav.login")}
						</a>
						<a
							href="/register"
							className="text-sm bg-[var(--orange)] text-black font-semibold px-5 py-2.5 rounded-full hover:bg-amber-400 transition-all hover:scale-[1.03] active:scale-[0.98]"
						>
							{t("landing.nav.start")}
						</a>
					</div>
				</div>
			</nav>

			{/* ─── HERO ─── */}
			<section className="relative pt-32 md:pt-44 pb-16 md:pb-32 px-4 md:px-6">
				<div className="absolute inset-0 overflow-hidden pointer-events-none">
					<div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-[var(--brand-green)]/5 rounded-full blur-[120px]" />
					<div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-[var(--orange)]/5 rounded-full blur-[100px]" />
				</div>
				<div className="max-w-4xl mx-auto text-center relative z-10">
					<div className="inline-flex items-center gap-2 text-xs font-medium text-[var(--brand-green)] bg-teal-500/10 border border-teal-500/20 px-4 py-2 rounded-full mb-8 md:mb-10">
						<Zap className="h-3 w-3" />
						{t("landing.hero.badge")}
					</div>

					<h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight mb-6 md:mb-8">
						{t("landing.hero.title1")}{" "}
						<span className="bg-gradient-to-r from-[var(--brand-green)] via-teal-300 to-[var(--orange)] bg-clip-text text-transparent">
							{t("landing.hero.title2")}
						</span>
					</h1>

					<p className="text-base md:text-xl text-white/50 max-w-xl mx-auto leading-relaxed mb-10 md:mb-12">
						{t("landing.hero.subtitle")}
					</p>

					<div className="flex flex-col sm:flex-row gap-4 justify-center">
						<a
							href="/register"
							className="inline-flex items-center justify-center gap-2 bg-[var(--orange)] text-black font-semibold px-8 py-4 rounded-full text-base md:text-lg hover:bg-amber-400 transition-all hover:scale-[1.03] active:scale-[0.98] shadow-xl shadow-amber-500/20"
						>
							{t("landing.hero.cta")} <ArrowRight className="h-5 w-5" />
						</a>
						<button
							onClick={() => scrollTo("how")}
							className="inline-flex items-center justify-center gap-2 border border-white/10 text-white font-medium px-8 py-4 rounded-full text-base md:text-lg hover:bg-white/5 transition-all"
						>
							{t("landing.hero.demo")} <ChevronDown className="h-5 w-5" />
						</button>
					</div>
				</div>
			</section>

			{/* ─── DASHBOARD PREVIEW ─── */}
			<section className="px-4 md:px-6 pb-16 md:pb-24">
				<div className="max-w-5xl mx-auto">
					<div className="relative rounded-2xl md:rounded-3xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40">
						<div className="absolute inset-0 bg-gradient-to-t from-[var(--prussian-blue)]/40 to-transparent pointer-events-none z-10" />
						<div className="absolute -inset-1 bg-gradient-to-r from-[var(--brand-green)]/20 via-transparent to-[var(--orange)]/20 rounded-2xl md:rounded-3xl blur-2xl opacity-50" />
						<img
							src="/dashboard-preview.png"
							alt="Dashboard preview"
							className="w-full relative z-0"
						/>
					</div>
				</div>
			</section>

			{/* ─── VALUE PROPOSITION ─── */}
			<section className="py-16 md:py-32 px-4 md:px-6">
				<div className="max-w-5xl mx-auto">
					<div className="grid md:grid-cols-3 gap-6 md:gap-8">
						{valueProps.map(({ icon: Icon, title, desc }) => (
							<div
								key={title}
								className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-8 md:p-10 hover:bg-white/[0.04] hover:border-white/10 transition-all duration-500"
							>
								<div className="w-12 h-12 rounded-2xl bg-[var(--brand-green)]/10 flex items-center justify-center mb-6 group-hover:bg-[var(--brand-green)]/20 transition-colors">
									<Icon className="h-6 w-6 text-[var(--brand-green)]" />
								</div>
								<h3 className="text-lg md:text-xl font-semibold mb-3">
									{title}
								</h3>
								<p className="text-sm md:text-base text-white/40 leading-relaxed">
									{desc}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* ─── HOW IT WORKS ─── */}
			<section
				id="how"
				className="py-16 md:py-32 px-4 md:px-6 border-y border-white/5"
			>
				<div className="max-w-5xl mx-auto">
					<div className="text-center mb-12 md:mb-20">
						<h2 className="text-2xl md:text-4xl font-bold mb-4">
							{t("landing.flow.title")}
						</h2>
						<p className="text-sm md:text-base text-white/40 max-w-md mx-auto">
							{t("landing.flow.subtitle")}
						</p>
					</div>
					<div className="grid md:grid-cols-3 gap-6 md:gap-8">
						{[
							{
								step: "01",
								icon: Cpu,
								title: "Connect",
								desc: "Wire sensors and actuators to an ESP32. AI auto-detects your hardware and generates the configuration.",
							},
							{
								step: "02",
								icon: Wifi,
								title: "Flash",
								desc: "One click loads the firmware via USB. The device connects to WiFi and the cloud automatically.",
							},
							{
								step: "03",
								icon: LayoutDashboard,
								title: "Control",
								desc: "Real-time dashboard with temperature, relays, and automatic rules. All from your browser.",
							},
						].map(({ step, icon: Icon, title, desc }) => (
							<div key={step} className="relative group">
								<div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 md:p-10 h-full hover:bg-white/[0.04] hover:border-white/10 transition-all duration-500">
									<div className="text-[var(--brand-green)]/30 text-5xl md:text-6xl font-bold mb-6 tracking-tighter">
										{step}
									</div>
									<div className="w-10 h-10 rounded-xl bg-[var(--brand-green)]/10 flex items-center justify-center mb-5">
										<Icon className="h-5 w-5 text-[var(--brand-green)]" />
									</div>
									<h3 className="text-lg md:text-xl font-semibold mb-3">
										{title}
									</h3>
									<p className="text-sm text-white/40 leading-relaxed">
										{desc}
									</p>
								</div>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* ─── FEATURES ─── */}
			<section id="features" className="py-16 md:py-32 px-4 md:px-6">
				<div className="max-w-5xl mx-auto">
					<div className="text-center mb-12 md:mb-20">
						<h2 className="text-2xl md:text-4xl font-bold mb-4">
							{t("landing.features.title")}
						</h2>
						<p className="text-sm md:text-base text-white/40 max-w-md mx-auto">
							{t("landing.features.subtitle")}
						</p>
					</div>
					<div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
						{features.map(({ icon: Icon, label }) => (
							<div
								key={label}
								className="group rounded-2xl border border-white/5 bg-white/[0.01] p-5 md:p-8 flex flex-col items-center text-center gap-3 md:gap-4 hover:border-[var(--brand-green)]/20 hover:bg-white/[0.03] transition-all duration-500"
							>
								<div className="w-10 h-10 rounded-xl bg-[var(--brand-green)]/10 flex items-center justify-center group-hover:bg-[var(--brand-green)]/20 transition-colors">
									<Icon className="h-5 w-5 text-[var(--brand-green)]" />
								</div>
								<span className="text-sm md:text-base font-medium text-white/70">
									{label}
								</span>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* ─── AI SECTION ─── */}
			<section className="py-16 md:py-32 px-4 md:px-6 border-y border-white/5">
				<div className="max-w-3xl mx-auto text-center">
					<div className="inline-flex items-center gap-2 text-xs font-medium text-purple-400 bg-purple-500/10 border border-purple-500/20 px-4 py-2 rounded-full mb-8 md:mb-10">
						✨ {t("landing.ai.badge")}
					</div>
					<h2 className="text-2xl md:text-4xl font-bold mb-6">
						{t("landing.ai.title1")}{" "}
						<span className="bg-gradient-to-r from-purple-400 to-[var(--orange)] bg-clip-text text-transparent">
							{t("landing.ai.title2")}
						</span>
					</h2>
					<div className="rounded-2xl border border-purple-500/10 bg-white/[0.02] p-6 md:p-10 text-left max-w-xl mx-auto">
						<div className="flex gap-4">
							<div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0 mt-1">
								<span className="text-lg">🤖</span>
							</div>
							<div className="space-y-4">
								<p className="text-sm text-white/50 italic">
									"{t("landing.ai_demo.prompt")}"
								</p>
								<div className="rounded-xl bg-green-500/10 border border-green-500/20 p-5 space-y-2">
									<div className="flex items-center gap-2 text-green-400 text-sm font-medium">
										<CheckCircle2 className="h-4 w-4" />
										{t("landing.ai_demo.response1")}
									</div>
									<p className="text-xs text-green-400/70 pl-6">
										{t("landing.ai_demo.response2")}
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* ─── PRICING ─── */}
			<section id="pricing" className="py-16 md:py-32 px-4 md:px-6">
				<div className="max-w-4xl mx-auto text-center">
					<h2 className="text-2xl md:text-4xl font-bold mb-4">
						{t("landing.pricing.title")}
					</h2>
					<p className="text-sm md:text-base text-white/40 max-w-lg mx-auto mb-12 md:mb-16">
						{t("landing.pricing.subtitle")}
					</p>
					<div className="max-w-md mx-auto">
						<div className="relative rounded-3xl border border-[var(--brand-green)]/20 bg-white/[0.02] p-8 md:p-12 overflow-hidden">
							<div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--brand-green)]/40 to-transparent" />
							<div className="text-5xl md:text-6xl font-bold mb-4 tracking-tight">
								{t("landing.pricing.price")}
								<span className="text-lg md:text-xl text-white/30 font-normal ml-1">
									{t("landing.pricing.period")}
								</span>
							</div>
							<p className="text-sm text-white/40 mb-8">
								{t("landing.pricing.note")}
							</p>
							<ul className="space-y-3 text-left mb-8">
								{[
									"Unlimited devices",
									"Unlimited clients",
									"AI Assistant",
									"Professional dashboard",
									"OTA updates",
									"Automatic rules",
									"Priority support",
								].map((f) => (
									<li
										key={f}
										className="flex items-center gap-3 text-sm text-white/50"
									>
										<CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
										{f}
									</li>
								))}
							</ul>
							<a
								href="/register"
								className="block w-full text-center bg-[var(--orange)] text-black font-semibold py-4 rounded-full text-base hover:bg-amber-400 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-amber-500/20"
							>
								{t("landing.pricing.cta")}
							</a>
						</div>
					</div>
				</div>
			</section>

			{/* ─── FINAL CTA ─── */}
			<section className="py-16 md:py-32 px-4 md:px-6 border-t border-white/5">
				<div className="max-w-2xl mx-auto text-center">
					<h2 className="text-2xl md:text-4xl font-bold mb-4">
						Start building your IoT infrastructure today
					</h2>
					<p className="text-sm md:text-base text-white/40 mb-10">
						Get started in less than 2 minutes. No credit card required.
					</p>
					<a
						href="/register"
						className="inline-flex items-center justify-center gap-2 bg-[var(--orange)] text-black font-semibold px-10 py-5 rounded-full text-lg hover:bg-amber-400 transition-all hover:scale-[1.03] active:scale-[0.98] shadow-xl shadow-amber-500/20"
					>
						Create free account <ArrowRight className="h-5 w-5" />
					</a>
				</div>
			</section>

			{/* ─── FOOTER ─── */}
			<footer className="py-12 md:py-16 px-4 md:px-6 border-t border-white/5">
				<div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
					<div className="flex items-center gap-3">
						<img src={logo} alt="ioTech" className="h-20 md:h-28 w-auto" />
						<span className="text-xs text-white/20 hidden md:inline">
							Built for modern IoT development
						</span>
					</div>
					<p className="text-xs text-white/20">{t("landing.footer")}</p>
				</div>
			</footer>
			<style>{`html{scroll-behavior:smooth}`}</style>
		</div>
	);
}
