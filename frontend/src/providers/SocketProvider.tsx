import { createContext, useContext, useEffect, useRef, useState } from 'react'
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

interface TelemetryEvent {
  deviceId: string
  datastreamKey: string
  value: unknown
  timestamp: number
}

/**
 * Manages the Socket.io connection lifecycle.
 *
 * - Connects automatically when the user is authenticated (has an access token).
 * - Disconnects and reconnects when the token changes (e.g. after refresh).
 * - Disconnects on logout.
 * - Writes incoming `telemetry` events to `telemetryStore` (REQ-DASH-016).
 * - Configured with unlimited reconnection attempts and exponential back-off (REQ-DASH-015).
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null)
  const [socket, setSocket] = useState<Socket | null>(null)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const accessToken = useAuthStore((s) => s.accessToken)
  const setTelemetry = useTelemetryStore((s) => s.setTelemetry)
  const setDeviceOnlineStatus = useDeviceStore((s) => s.setDeviceOnlineStatus)

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      // Disconnect if we lose auth
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        setSocket(null)
      }
      return
    }

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
    Promise.resolve().then(() => setSocket(newSocket))

    newSocket.on('connect', () => {
      console.debug('[Socket] connected', newSocket.id)
    })

    newSocket.on('disconnect', (reason) => {
      console.debug('[Socket] disconnected', reason)
    })

    newSocket.on('connect_error', (err) => {
      console.warn('[Socket] connection error', err.message)
    })

    newSocket.on('telemetry', (event: TelemetryEvent) => {
      setTelemetry(
        event.deviceId,
        event.datastreamKey,
        event.value,
        event.timestamp || Date.now()
      )
    })

    newSocket.on('device:status', ({ deviceId, status }: { deviceId: string; status: 'online' | 'offline' }) => {
      setDeviceOnlineStatus(deviceId, status)
    })

    return () => {
      newSocket.disconnect()
      socketRef.current = null
      setSocket(null)
    }
  }, [isAuthenticated, accessToken, setTelemetry, setDeviceOnlineStatus])

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  )
}
