import { createContext, useContext, useEffect, useRef, useState, startTransition } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useAuthStore } from '@/features/auth/authStore'
import { useTelemetryStore } from '@/stores/telemetryStore'
import { useDeviceStore } from '@/features/devices/deviceStore'

/**
 * Exposes the raw Socket.io socket instance to child components.
 * Most consumers should use `useTelemetryValue` instead — only use
 * the socket directly for custom emit calls.
 */
interface SocketContextValue {
  socket: Socket | null
}

const SocketContext = createContext<SocketContextValue>({ socket: null })

/** Access the raw Socket.io socket. Returns null when unauthenticated. */
// eslint-disable-next-line react-refresh/only-export-components
export function useSocket() {
  return useContext(SocketContext)
}

/**
 * Backend emits a flat structure per emitTelemetry():
 *   { id, deviceId, data: { temperature: 25.1, humidity: 41.5 }, receivedAt }
 *
 * The telemetryStore expects per-stream events, so we explode the `data`
 * object into individual setTelemetry() calls — one per datastream key.
 */
interface BackendTelemetryPayload {
  deviceId: string
  data: Record<string, unknown>
  receivedAt?: string
  id?: string
}

/**
 * Manages the Socket.io connection lifecycle.
 *
 * - Connects once when the user is authenticated (has an access token).
 * - On token rotation: updates socket.auth in-place and calls disconnect() so
 *   Socket.IO reconnects with the new token — avoids tearing down listeners.
 * - Disconnects on logout (isAuthenticated → false).
 * - Writes incoming `telemetry:new` events to `telemetryStore` (REQ-DASH-016).
 * - Listens to `device:status` and updates deviceStore reactively (no polling needed).
 * - Configured with unlimited reconnection attempts and exponential back-off (REQ-DASH-015).
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null)
  const [socket, setSocket] = useState<Socket | null>(null)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const accessToken = useAuthStore((s) => s.accessToken)
  const setTelemetry = useTelemetryStore((s) => s.setTelemetry)
  const setDeviceOnlineStatus = useDeviceStore((s) => s.setDeviceOnlineStatus)

  // ── Create socket once on first auth ────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        setSocket(null)
      }
      return
    }

    // Already connected — don't recreate
    if (socketRef.current) return

    const SOCKET_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

    const newSocket = io(SOCKET_URL, {
      auth: { token: accessToken },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      transports: ['websocket'],
    })

    socketRef.current = newSocket
    setSocket(newSocket)

    newSocket.on('connect', () => {
      console.debug('[Socket] connected', newSocket.id)
    })

    newSocket.on('disconnect', (reason) => {
      console.debug('[Socket] disconnected', reason)
    })

    newSocket.on('connect_error', (err) => {
      console.warn('[Socket] connection error', err.message)
    })

    // Backend emits 'telemetry:new' with { deviceId, data: { temperature: 25.1, ... }, receivedAt }
    // The store expects per-stream calls — explode the data object into individual setTelemetry() calls.
    newSocket.on('telemetry:new', (event: BackendTelemetryPayload) => {
      const { deviceId, data, receivedAt } = event
      const ts = receivedAt ? new Date(receivedAt).getTime() : Date.now()
      if (data && typeof data === 'object') {
        for (const [key, value] of Object.entries(data)) {
          setTelemetry(deviceId, key, value, ts)
        }
      }
    })

    // Real-time device online/offline — no polling needed
    newSocket.on('device:status', ({ deviceId, status }: { deviceId: string; status: 'online' | 'offline' }) => {
      startTransition(() => {
        setDeviceOnlineStatus(deviceId, status)
      })
    })

    return () => {
      newSocket.disconnect()
      socketRef.current = null
      setSocket(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]) // intentionally omit accessToken — handled below

  // ── Token rotation: update auth without recreating the socket ────────────────
  useEffect(() => {
    if (!socketRef.current || !accessToken) return
    // Update the token used for the next reconnect handshake
    socketRef.current.auth = { token: accessToken }
    // If currently disconnected (e.g. expired token caused connect_error),
    // trigger a reconnect with the fresh token
    if (!socketRef.current.connected) {
      socketRef.current.connect()
    }
  }, [accessToken])

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  )
}
