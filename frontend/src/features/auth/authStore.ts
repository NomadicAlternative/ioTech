import { create } from 'zustand'
import api from '@/lib/axios'

/**
 * Represents the authenticated user decoded from the JWT payload.
 */
interface AuthUser {
  id: string
  email: string
  role: string
  tenantId: string
}

/**
 * State slice for authentication.
 * - `accessToken` lives in memory only (not localStorage) to prevent XSS exposure (AD-DASH-003).
 * - `refresh` token is sent as an httpOnly cookie by the backend.
 */
interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  isAuthenticated: boolean
  isSuperAdmin: boolean
}

interface AuthActions {
  /** POST /auth/login — stores access token in memory and decodes user from JWT. */
  login: (email: string, password: string) => Promise<void>
  /** POST /auth/logout (best-effort) + clears in-memory state. */
  logout: () => Promise<void>
  /** POST /auth/refresh — called by the Axios interceptor on 401. */
  refreshToken: () => Promise<void>
  /** Direct setter used by tests and internal flows. */
  setUser: (user: AuthUser) => void
}

type AuthStore = AuthState & AuthActions

/**
 * Decode the JWT payload section without verifying the signature.
 * Signature verification is the backend's responsibility.
 */
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

/**
 * Zustand store for authentication state.
 *
 * @example
 * const { login, isAuthenticated, user } = useAuthStore()
 */
export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isSuperAdmin: false,

  login: async (email: string, password: string) => {
    const res = await api.post<{ accessToken: string }>('/api/auth/login', {
      email,
      password,
    })
    const { accessToken } = res.data
    const user = decodeJwtPayload(accessToken)
    const isSuperAdmin = ['admin@iotech.dev', 'diego@instalador.com'].includes(user.email)
    set({ accessToken, user, isAuthenticated: true, isSuperAdmin })
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
    // refresh token is sent automatically as httpOnly cookie
    const res = await api.post<{ accessToken: string }>('/api/auth/refresh')
    const { accessToken } = res.data
    const user = decodeJwtPayload(accessToken)
    const isSuperAdmin = ['admin@iotech.dev', 'diego@instalador.com'].includes(user.email)
    set({ accessToken, user, isAuthenticated: true, isSuperAdmin })
  },

  setUser: (user: AuthUser) => set({ user }),
}))
