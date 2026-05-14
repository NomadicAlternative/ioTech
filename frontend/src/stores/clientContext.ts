import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Client {
  id: string
  name: string
}

interface ClientContextState {
  activeClient: Client | null
  setActiveClient: (client: Client | null) => void
}

export const useClientContext = create<ClientContextState>()(
  persist(
    (set) => ({
      activeClient: null,
      setActiveClient: (client) => set({ activeClient: client }),
    }),
    { name: 'iotech-client' }
  )
)
