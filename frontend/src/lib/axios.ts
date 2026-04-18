import axios, {
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'
import { useAuthStore } from '@/features/auth/authStore'

/**
 * Pre-configured Axios instance for all API calls.
 *
 * - Base URL from `VITE_API_URL` (defaults to localhost:3000).
 * - `withCredentials: true` to send the httpOnly refresh cookie automatically.
 * - Request interceptor injects the in-memory access token as a Bearer header.
 * - Response interceptor handles 401 with a singleton refresh flow (AD-DASH-004):
 *   parallel 401s queue and share a single refresh promise to avoid thundering herd.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  withCredentials: true, // httpOnly refresh cookie
})

// ─── Request interceptor ─────────────────────────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ─── Refresh queue ───────────────────────────────────────────────────────────
let refreshPromise: Promise<void> | null = null

interface FailedRequest {
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
  config: AxiosRequestConfig
}

const failedQueue: FailedRequest[] = []

function processQueue(error: unknown, token: string | null = null) {
  for (const req of failedQueue) {
    if (error) {
      req.reject(error)
    } else {
      if (token && req.config.headers) {
        (req.config.headers as Record<string, string>).Authorization = `Bearer ${token}`
      }
      req.resolve(api(req.config))
    }
  }
  failedQueue.length = 0
}

// ─── Response interceptor ────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest: AxiosRequestConfig & { _retry?: boolean } =
      error.config ?? {}

    // Only handle 401, and don't retry refresh calls
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url?.includes('/api/auth/refresh')
    ) {
      return Promise.reject(error)
    }

    // If a refresh is already in progress, queue this request
    if (refreshPromise) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject, config: originalRequest })
      })
    }

    originalRequest._retry = true

    // Start the singleton refresh
    refreshPromise = useAuthStore
      .getState()
      .refreshToken()
      .then(() => {
        const newToken = useAuthStore.getState().accessToken
        processQueue(null, newToken)
      })
      .catch((refreshError) => {
        processQueue(refreshError, null)
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      })
      .finally(() => {
        refreshPromise = null
      })

    await refreshPromise

    // Retry the original request with the new token
    const newToken = useAuthStore.getState().accessToken
    if (newToken && originalRequest.headers) {
      (originalRequest.headers as Record<string, string>).Authorization =
        `Bearer ${newToken}`
    }
    return api(originalRequest)
  }
)

export default api
