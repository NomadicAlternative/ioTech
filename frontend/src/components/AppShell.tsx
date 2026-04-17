import { Outlet, NavLink } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/authStore'
import { Button } from '@/components/ui/button'

const navItems = [
  { to: '/app/dashboards', label: 'Dashboards' },
  { to: '/app/devices', label: 'Devices' },
  { to: '/app/clients', label: 'Clients' },
  { to: '/app/settings', label: 'Settings' },
]

export function AppShell() {
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex flex-col border-r bg-sidebar shrink-0">
        <div className="px-6 py-5 border-b">
          <span className="text-lg font-semibold tracking-tight">IoTech</span>
        </div>
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t">
          <div className="flex items-center justify-between gap-2 px-2 py-1">
            <span className="text-xs text-muted-foreground truncate">
              {user?.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout()}
              className="shrink-0"
            >
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b flex items-center px-6 shrink-0">
          <span className="text-sm text-muted-foreground">
            {user?.role && (
              <span className="uppercase text-xs font-medium bg-muted px-2 py-0.5 rounded">
                {user.role}
              </span>
            )}
          </span>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
