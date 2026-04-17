import { create } from 'zustand'
import api from '@/lib/axios'

interface AuthUser {
  id: string
  email: string
  role: string
  tenantId: string
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  isAuthenticated: boolean
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
  setUser: (user: AuthUser) => void
}

type AuthStore = AuthState & AuthActions

function decodeJwtPayload(token: string): AuthUser {
  const base64Url = token.split('.')[1]
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  )
  const payload = JSON.parse(jsonPayload)
  return {
    id: payload.sub ?? payload.id,
    email: payload.email,
    role: payload.role,
    tenantId: payload.tenantId,
  }
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    const res = await api.post<{ accessToken: string }>('/api/auth/login', {
      email,
      password,
    })
    const { accessToken } = res.data
    const user = decodeJwtPayload(accessToken)
    set({ accessToken, user, isAuthenticated: true })
  },

  logout: async () => {
    try {
      await api.post('/api/auth/logout')
    } catch {
      // best-effort
    }
    set({ user: null, accessToken: null, isAuthenticated: false })
  },

  refreshToken: async () => {
    const res = await api.post<{ accessToken: string }>('/api/auth/refresh')
    const { accessToken } = res.data
    const user = decodeJwtPayload(accessToken)
    set({ accessToken, user, isAuthenticated: true })
  },

  setUser: (user: AuthUser) => set({ user }),
}))
