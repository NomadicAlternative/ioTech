import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Client {
  id: string
  name: string
  email?: string
}

interface ClientContextState {
  activeClient: Client | null
  setActiveClient: (client: Client | null) => void
  clearClient: () => void
}

export const useClientContext = create<ClientContextState>()(
  persist(
    (set) => ({
      activeClient: null,
      setActiveClient: (client) => set({ activeClient: client }),
      clearClient: () => set({ activeClient: null }),
    }),
    { name: 'iotech-client-context' }
  )
)
