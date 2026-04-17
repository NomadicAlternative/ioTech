import { createContext, useContext, useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useAuthStore } from '@/features/auth/authStore'
import { useTelemetryStore } from '@/stores/telemetryStore'

interface SocketContextValue {
  socket: Socket | null
}

const SocketContext = createContext<SocketContextValue>({ socket: null })

export function useSocket() {
  return useContext(SocketContext)
}

interface TelemetryEvent {
  deviceId: string
  datastreamKey: string
  value: unknown
  timestamp: number
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const accessToken = useAuthStore((s) => s.accessToken)
  const setTelemetry = useTelemetryStore((s) => s.setTelemetry)

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      // Disconnect if we lose auth
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      return
    }

    const SOCKET_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

    const socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      transports: ['websocket'],
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.debug('[Socket] connected', socket.id)
    })

    socket.on('disconnect', (reason) => {
      console.debug('[Socket] disconnected', reason)
    })

    socket.on('connect_error', (err) => {
      console.warn('[Socket] connection error', err.message)
    })

    socket.on('telemetry', (event: TelemetryEvent) => {
      setTelemetry(
        event.deviceId,
        event.datastreamKey,
        event.value,
        event.timestamp ?? Date.now()
      )
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [isAuthenticated, accessToken, setTelemetry])

  return (
    <SocketContext.Provider value={{ socket: socketRef.current }}>
      {children}
    </SocketContext.Provider>
  )
}
