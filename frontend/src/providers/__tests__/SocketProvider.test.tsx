import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'

// ─── Mock socket.io-client ────────────────────────────────────────────────────
const mockSocketOn = vi.fn()
const mockSocketDisconnect = vi.fn()
const mockSocket = {
  on: mockSocketOn,
  disconnect: mockSocketDisconnect,
  id: 'socket-test-id',
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}))

import { io } from 'socket.io-client'
import { useAuthStore } from '@/features/auth/authStore'
import { useTelemetryStore } from '@/stores/telemetryStore'
import { SocketProvider } from '@/providers/SocketProvider'

const mockIo = io as MockedFunction<typeof io>

// Helper: get the callback registered for a specific event
function getEventCallback(eventName: string) {
  const call = mockSocketOn.mock.calls.find(([event]) => event === eventName)
  return call?.[1]
}

function renderProvider(children = <div data-testid="child">Child</div>) {
  return render(<SocketProvider>{children}</SocketProvider>)
}

describe('SocketProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useTelemetryStore.getState().clearAll()
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
    // Reset the mock to return our mock socket
    mockIo.mockReturnValue(mockSocket as unknown as ReturnType<typeof io>)
  })

  it('does NOT connect socket when not authenticated', () => {
    useAuthStore.setState({ isAuthenticated: false, accessToken: null, user: null })

    renderProvider()

    expect(io).not.toHaveBeenCalled()
  })

  it('connects socket when authenticated with accessToken', async () => {
    await act(async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        accessToken: 'test-token',
        user: { id: 'u1', email: 'a@b.com', role: 'installer', tenantId: 't1' },
      })
    })

    renderProvider()

    await waitFor(() => {
      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ auth: { token: 'test-token' } })
      )
    })
  })

  it('registers a telemetry event listener on connect', async () => {
    await act(async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        accessToken: 'test-token',
        user: { id: 'u1', email: 'a@b.com', role: 'installer', tenantId: 't1' },
      })
    })

    renderProvider()

    await waitFor(() => {
      expect(mockSocketOn).toHaveBeenCalledWith('telemetry', expect.any(Function))
    })
  })

  it('updates telemetryStore when telemetry event fires', async () => {
    await act(async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        accessToken: 'test-token',
        user: { id: 'u1', email: 'a@b.com', role: 'installer', tenantId: 't1' },
      })
    })

    renderProvider()

    await waitFor(() => {
      expect(mockSocketOn).toHaveBeenCalledWith('telemetry', expect.any(Function))
    })

    const telemetryCallback = getEventCallback('telemetry')
    expect(telemetryCallback).toBeDefined()

    act(() => {
      telemetryCallback!({
        deviceId: 'dev-1',
        datastreamKey: 'temperature',
        value: 22.5,
        timestamp: 12345,
      })
    })

    const entry = useTelemetryStore.getState().getTelemetry('dev-1:temperature')
    expect(entry?.value).toBe(22.5)
    expect(entry?.ts).toBe(12345)
  })

  it('uses Date.now() as ts when event has no timestamp', async () => {
    const fakeNow = 99999
    vi.spyOn(Date, 'now').mockReturnValue(fakeNow)

    await act(async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        accessToken: 'test-token',
        user: { id: 'u1', email: 'a@b.com', role: 'installer', tenantId: 't1' },
      })
    })

    renderProvider()

    await waitFor(() => {
      expect(mockSocketOn).toHaveBeenCalledWith('telemetry', expect.any(Function))
    })

    const telemetryCallback = getEventCallback('telemetry')

    act(() => {
      telemetryCallback!({
        deviceId: 'dev-2',
        datastreamKey: 'humidity',
        value: 60,
        timestamp: 0, // falsy → Date.now() fallback
      })
    })

    const entry = useTelemetryStore.getState().getTelemetry('dev-2:humidity')
    // timestamp=0 is falsy, so Date.now() is used
    expect(entry?.ts).toBe(fakeNow)
  })

  it('disconnects socket on component unmount', async () => {
    await act(async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        accessToken: 'test-token',
        user: { id: 'u1', email: 'a@b.com', role: 'installer', tenantId: 't1' },
      })
    })

    const { unmount } = renderProvider()

    await waitFor(() => expect(io).toHaveBeenCalled())

    unmount()

    expect(mockSocketDisconnect).toHaveBeenCalled()
  })

  it('disconnects socket when auth is revoked', async () => {
    await act(async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        accessToken: 'test-token',
        user: { id: 'u1', email: 'a@b.com', role: 'installer', tenantId: 't1' },
      })
    })

    renderProvider()

    await waitFor(() => expect(io).toHaveBeenCalled())

    act(() => {
      useAuthStore.setState({ isAuthenticated: false, accessToken: null, user: null })
    })

    await waitFor(() => {
      expect(mockSocketDisconnect).toHaveBeenCalled()
    })
  })

  it('connects with reconnection options', async () => {
    await act(async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        accessToken: 'test-token',
        user: { id: 'u1', email: 'a@b.com', role: 'installer', tenantId: 't1' },
      })
    })

    renderProvider()

    await waitFor(() => {
      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          reconnection: true,
          reconnectionAttempts: Infinity,
        })
      )
    })
  })
})
