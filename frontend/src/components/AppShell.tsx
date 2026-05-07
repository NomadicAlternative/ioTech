import { Outlet, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/features/auth/authStore'
import i18n from '@/i18n/i18n'
import {
  LayoutDashboard,
  Cpu,
  FileCode2,
  Users,
  Settings,
  LogOut,
  Globe,
  ShieldCheck,
  Bot,
  Download,
} from 'lucide-react'
import logoSrc from '@/assets/logo.svg'

const NAV_ITEMS = [
  { to: '/app/dashboards', icon: LayoutDashboard, labelKey: 'nav.dashboards' },
  { to: '/app/devices',    icon: Cpu,             labelKey: 'nav.devices' },
  { to: '/app/rules',      icon: Bot,             labelKey: 'nav.rules' },
  { to: '/app/templates',  icon: FileCode2,        labelKey: 'nav.templates' },
  { to: '/app/firmware',   icon: Download,         labelKey: 'nav.firmware' },
  { to: '/app/clients',    icon: Users,            labelKey: 'nav.clients' },
  { to: '/app/settings',   icon: Settings,         labelKey: 'nav.settings' },
]

export function AppShell() {
  const { t } = useTranslation()
  const logout = useAuthStore((s) => s.logout)
  const user   = useAuthStore((s) => s.user)
  const currentLang = i18n.language?.startsWith('es') ? 'es' : 'en'

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ── */}
      <aside className="w-64 flex flex-col shrink-0 bg-sidebar border-r border-sidebar-border">

        {/* Brand */}
        <div className="px-6 py-5 border-b border-sidebar-border">
          <img src={logoSrc} alt="IoTech" className="h-10 w-auto object-contain" />
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 p-3 flex-1 overflow-y-auto">
          {NAV_ITEMS.map(({ to, icon: Icon, labelKey }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'opacity-100' : 'opacity-60'}`} />
                  {t(labelKey)}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-sidebar-border space-y-1">
          {/* Language switcher */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg">
            <Globe className="w-4 h-4 text-sidebar-foreground/50 shrink-0" />
            <span className="text-xs text-sidebar-foreground/50 flex-1">{t('nav.language')}</span>
            <div className="flex items-center gap-1 bg-sidebar-accent rounded-md p-0.5">
              <button
                onClick={() => i18n.changeLanguage('es')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                  currentLang === 'es'
                    ? 'text-sidebar-primary-foreground shadow-sm'
                    : 'text-sidebar-foreground/60 hover:text-sidebar-foreground'
                }`}
                style={currentLang === 'es' ? { background: 'var(--brand-amber)' } : {}}
              >
                ES
              </button>
              <button
                onClick={() => i18n.changeLanguage('en')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                  currentLang === 'en'
                    ? 'text-sidebar-primary-foreground shadow-sm'
                    : 'text-sidebar-foreground/60 hover:text-sidebar-foreground'
                }`}
                style={currentLang === 'en' ? { background: 'var(--brand-amber)' } : {}}
              >
                EN
              </button>
            </div>
          </div>

          {/* User + logout */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-sidebar-accent transition-colors group">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white"
                 style={{ background: 'var(--brand-cerulean)' }}>
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <span className="text-xs text-sidebar-foreground/70 truncate flex-1">
              {user?.email}
            </span>
            <button
              onClick={() => logout()}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-sidebar-foreground/50 hover:text-red-400"
              title={t('nav.logout')}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Top bar */}
        <header className="h-14 border-b bg-card flex items-center justify-between px-6 shrink-0">
          <div />
          {user?.role && (
            <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
                 style={{ background: 'color-mix(in oklch, var(--brand-imperial) 12%, transparent)', color: 'var(--brand-imperial)' }}>
              <ShieldCheck className="w-3.5 h-3.5" />
              {user.role.toUpperCase()}
            </div>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6 bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
