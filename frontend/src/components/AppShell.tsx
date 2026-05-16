import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/features/auth/authStore'
import i18n from '@/i18n/i18n'
import {
  LayoutDashboard, Cpu, FileCode2, Users, Settings, LogOut, Globe, ShieldCheck,
  Bot, Download, Cable, Building2, Menu, X, Wand2,
} from 'lucide-react'

const INSTALLER_NAV_ITEMS = [
  { to: '/app/dashboards', icon: LayoutDashboard, labelKey: 'nav.dashboards' },
  { to: '/app/devices',    icon: Cpu,             labelKey: 'nav.devices' },
  { to: '/app/rules',      icon: Bot,             labelKey: 'nav.rules' },
  { to: '/app/templates',  icon: FileCode2,        labelKey: 'nav.templates' },
  { to: '/app/firmware',   icon: Download,         labelKey: 'nav.firmware' },
  { to: '/app/ai',         icon: Wand2,            labelKey: 'nav.ai' },
  { to: '/app/provision',  icon: Cable,            labelKey: 'nav.provision' },
  { to: '/app/clients',    icon: Users,            labelKey: 'nav.clients' },
  { to: '/app/settings',   icon: Settings,         labelKey: 'nav.settings' },
]

const ADMIN_NAV_ITEMS = [
  { to: '/app/admin/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { to: '/app/tenants',         icon: Building2,       labelKey: 'nav.installers' },
]

export function AppShell() {
  const { t } = useTranslation()
  const logout = useAuthStore((s) => s.logout)
  const user   = useAuthStore((s) => s.user)
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin)
  const currentLang = i18n.language?.startsWith('es') ? 'es' : 'en'
  const [sidebarOpen, setSidebarOpen] = useState(false)

  function closeSidebar() { setSidebarOpen(false) }

  const navItems = isSuperAdmin ? ADMIN_NAV_ITEMS : INSTALLER_NAV_ITEMS

  const NavItems = () => (
    <>
      {navItems.map(({ to, icon: Icon, labelKey }) => (
        <NavLink
          key={to}
          to={to}
          onClick={closeSidebar}
          className={({ isActive }) =>
            [
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
              isActive
                ? 'bg-sidebar-primary/30 text-sidebar-primary-foreground before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-amber-400'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
            ].join(' ')
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'opacity-100 text-amber-400' : 'opacity-50'}`} />
              {t(labelKey)}
            </>
          )}
        </NavLink>
      ))}
    </>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={[
          'fixed lg:static inset-y-0 left-0 z-50 w-64 flex flex-col shrink-0 bg-sidebar border-r border-sidebar-border transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        {/* Brand */}
        <div className="px-6 py-5 border-b border-sidebar-border flex items-center justify-between">
          <span className="text-2xl font-bold tracking-tight" style={{ color: 'var(--brand-imperial, #01295F)' }}>ioTech</span>
          <button
            onClick={closeSidebar}
            className="lg:hidden p-1 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/70"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 p-3 flex-1 overflow-y-auto">
          <NavItems />
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-sidebar-border space-y-1">
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
        <header className="h-14 border-b bg-card flex items-center justify-between px-4 lg:px-6 shrink-0">
          <button onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-md hover:bg-muted text-muted-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden lg:block" />
          {user?.role && (
            <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
                 style={{ background: 'color-mix(in oklch, var(--brand-imperial) 12%, transparent)', color: 'var(--brand-imperial)' }}>
              <ShieldCheck className="w-3.5 h-3.5" />
              {user.role.toUpperCase()}
            </div>
          )}
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6 bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
