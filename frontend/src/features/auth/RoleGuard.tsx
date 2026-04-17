import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from './authStore'

interface RoleGuardProps {
  role: string | string[]
  children: ReactNode
  fallback?: ReactNode
  redirectTo?: string
}

export function RoleGuard({
  role,
  children,
  fallback,
  redirectTo,
}: RoleGuardProps) {
  const userRole = useAuthStore((s) => s.user?.role)

  const allowed = Array.isArray(role)
    ? role.includes(userRole ?? '')
    : userRole === role

  if (!allowed) {
    if (redirectTo) return <Navigate to={redirectTo} replace />
    if (fallback)
      return (
        <div className="flex items-center justify-center min-h-screen">
          {fallback}
        </div>
      )
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold">403 — Forbidden</h1>
          <p className="text-muted-foreground mt-2">
            You don&apos;t have permission to access this page.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
