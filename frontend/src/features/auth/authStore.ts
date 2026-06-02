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
 * Decode the JWT `exp` claim to get the Unix timestamp when the token expires.
 * Returns 0 if decoding fails (defensive).
 */
function getTokenExp(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return (payload.exp || 0) * 1000 // convert to ms
  } catch {
    return 0
  }
}

/**
 * Start a proactive refresh timer. Called after login and after each successful refresh.
 * Refreshes 3 minutes before the access token expires (12 min for a 15-min token).
 * Stores the timer ID on window so it can be cleared on logout.
 */
function scheduleProactiveRefresh() {
  const token = useAuthStore.getState().accessToken
  if (!token) return

  const expMs = getTokenExp(token)
  if (!expMs) return

  const refreshAt = expMs - 3 * 60 * 1000 // 3 min before expiry
  const delay = Math.max(0, refreshAt - Date.now())

  // Clear any existing timer
  if ((window as unknown as Record<string, ReturnType<typeof setTimeout>>).__refreshTimer) {
    clearTimeout((window as unknown as Record<string, ReturnType<typeof setTimeout>>).__refreshTimer)
  }

  (window as unknown as Record<string, ReturnType<typeof setTimeout>>).__refreshTimer = setTimeout(async () => {
    try {
      await useAuthStore.getState().refreshToken()
      scheduleProactiveRefresh() // schedule the next one
    } catch {
      // refresh failed — the Axios interceptor will handle the redirect to login
    }
  }, delay)
}

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
    const isSuperAdmin = user.role === 'super_admin'
    set({ accessToken, user, isAuthenticated: true, isSuperAdmin })
    scheduleProactiveRefresh()
  },

  logout: async () => {
    // Clear proactive refresh timer
    const win = window as unknown as Record<string, ReturnType<typeof setTimeout>>
    if (win.__refreshTimer) { clearTimeout(win.__refreshTimer); delete win.__refreshTimer }
    try {
      await api.post('/api/auth/logout')
    } catch {
      // best-effort
    }
    set({ user: null, accessToken: null, isAuthenticated: false, isSuperAdmin: false })
  },

  refreshToken: async () => {
    // refresh token is sent automatically as httpOnly cookie
    const res = await api.post<{ accessToken: string }>('/api/auth/refresh')
    const { accessToken } = res.data
    const user = decodeJwtPayload(accessToken)
    const isSuperAdmin = user.role === 'super_admin'
    set({ accessToken, user, isAuthenticated: true, isSuperAdmin })
    scheduleProactiveRefresh()
  },

  setUser: (user: AuthUser) => set({ user }),
}))
