import type { ProvidersState } from '../../../shared/providers'
import { createStore } from '../lib/createStore'
import { useStore } from '../lib/useStore'

// Contas dos outros agentes (Codex, Gemini, Cursor), acompanhando o processo principal.
const providers = createStore<ProvidersState | null>(null)

window.api.providers.onState(providers.set)
window.api.providers.state().then(
  (state) => providers.set((current) => current ?? state),
  (err: unknown) => console.error('[agentes] estado inicial:', err)
)

export function useProviders(): ProvidersState | null {
  return useStore(providers)
}

// Fora de componente (menus do canvas): o estado de agora.
export function getProviders(): ProvidersState | null {
  return providers.get()
}
