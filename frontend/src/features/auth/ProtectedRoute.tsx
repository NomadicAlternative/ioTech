import { Navigate } from 'react-router-dom'
import { useAuthStore } from './authStore'
import { AppShell } from '@/components/AppShell'

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <AppShell />
}
