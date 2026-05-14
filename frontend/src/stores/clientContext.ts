import { create } from 'zustand'

interface Client {
  id: string
  name: string
}

interface ClientContextState {
  activeClient: Client | null
  setActiveClient: (client: Client | null) => void
}

export const useClientContext = create<ClientContextState>((set) => ({
  activeClient: null,
  setActiveClient: (client) => set({ activeClient: client }),
}))
