import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock AppShell to avoid importing full component tree
vi.mock('@/components/AppShell', () => ({
  AppShell: () => <div data-testid="app-shell"><div data-testid="outlet" /></div>,
}))

import { useAuthStore } from '@/features/auth/authStore'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { RoleGuard } from '@/features/auth/RoleGuard'

function resetAuth() {
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
}

function setAuth(role: string) {
  useAuthStore.setState({
    user: { id: 'u1', email: 'test@test.com', role, tenantId: 't1' },
    accessToken: 'token',
    isAuthenticated: true,
  })
}

// ─── ProtectedRoute ───────────────────────────────────────────────────────────
describe('ProtectedRoute', () => {
  beforeEach(resetAuth)

  it('redirects to /login when not authenticated', () => {
    render(
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route path="/app" element={<ProtectedRoute />} />
          <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByTestId('login-page')).toBeInTheDocument()
  })

  it('renders AppShell when authenticated', () => {
    setAuth('installer')

    render(
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route path="/app" element={<ProtectedRoute />} />
          <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByTestId('app-shell')).toBeInTheDocument()
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
  })
})

// ─── RoleGuard ────────────────────────────────────────────────────────────────
describe('RoleGuard', () => {
  beforeEach(resetAuth)

  it('shows children when user has the correct role', () => {
    setAuth('installer')

    render(
      <MemoryRouter>
        <RoleGuard role="installer">
          <div data-testid="protected-content">Installer Area</div>
        </RoleGuard>
      </MemoryRouter>
    )

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
  })

  it('hides children when user has wrong role — shows 403 fallback', () => {
    setAuth('client')

    render(
      <MemoryRouter>
        <RoleGuard role="installer">
          <div data-testid="protected-content">Installer Area</div>
        </RoleGuard>
      </MemoryRouter>
    )

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    expect(screen.getByText('403 — Forbidden')).toBeInTheDocument()
  })

  it('shows children when user role is in the allowed array', () => {
    setAuth('admin')

    render(
      <MemoryRouter>
        <RoleGuard role={['installer', 'admin']}>
          <div data-testid="multi-role-content">Admin + Installer Area</div>
        </RoleGuard>
      </MemoryRouter>
    )

    expect(screen.getByTestId('multi-role-content')).toBeInTheDocument()
  })

  it('blocks content when user role is NOT in the allowed array', () => {
    setAuth('client')

    render(
      <MemoryRouter>
        <RoleGuard role={['installer', 'admin']}>
          <div data-testid="multi-role-content">Restricted</div>
        </RoleGuard>
      </MemoryRouter>
    )

    expect(screen.queryByTestId('multi-role-content')).not.toBeInTheDocument()
  })

  it('renders custom fallback instead of 403 when provided', () => {
    setAuth('client')

    render(
      <MemoryRouter>
        <RoleGuard role="installer" fallback={<div data-testid="custom-fallback">No access</div>}>
          <div data-testid="content">Secret</div>
        </RoleGuard>
      </MemoryRouter>
    )

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument()
    expect(screen.queryByTestId('content')).not.toBeInTheDocument()
  })

  it('redirects when redirectTo prop is provided and role is wrong', () => {
    setAuth('client')

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={
            <RoleGuard role="installer" redirectTo="/not-authorized">
              <div data-testid="content">Secret</div>
            </RoleGuard>
          } />
          <Route path="/not-authorized" element={<div data-testid="not-authorized">Not Authorized</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByTestId('not-authorized')).toBeInTheDocument()
    expect(screen.queryByTestId('content')).not.toBeInTheDocument()
  })

  it('installer role (not client) can access installer-only content', () => {
    setAuth('installer')

    render(
      <MemoryRouter>
        <RoleGuard role="installer">
          <button data-testid="edit-button">Edit Dashboard</button>
        </RoleGuard>
      </MemoryRouter>
    )

    expect(screen.getByTestId('edit-button')).toBeInTheDocument()
  })

  it('client role cannot see installer-only edit button', () => {
    setAuth('client')

    render(
      <MemoryRouter>
        <RoleGuard role="installer">
          <button data-testid="edit-button">Edit Dashboard</button>
        </RoleGuard>
      </MemoryRouter>
    )

    expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument()
  })
})
