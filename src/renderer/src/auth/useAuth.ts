import type { AuthState } from '../../../shared/auth'
import { createStore } from '../lib/createStore'
import { useStore } from '../lib/useStore'
import { getProviders, useProviders } from '../providers/useProviders'
import { fallbackAgent, liveAccount } from './accounts'

// Os de fora importam daqui (canvas, conversa): as peças moram em arquivos próprios.
export { claudeReady, fallbackAgent, findAccount, liveAccount, resolveAccount } from './accounts'
export { AccountContext, useConversationAccount } from './accountContext'

// Contas do Claude Code e o login em andamento, acompanhando o processo principal. Um estado só
// para a janela inteira: a etiqueta de cada grupo, o uso e as configurações leem daqui.
const auth = createStore<AuthState | null>(null)

window.api.auth.onState(auth.set)
// Um aviso que chegou antes desta resposta é mais novo: prevalece.
window.api.auth.state().then(
  (state) => auth.set((current) => current ?? state),
  (err: unknown) => console.error('[contas] estado inicial:', err)
)

// Fora de componente (menus do canvas): o estado de agora.
export const getAuth = (): AuthState | null => auth.get()

// Fora de componente: o agente de quem não tem o Claude pronto (ver fallbackAgent).
export const getFallbackAgent = (): string | undefined => fallbackAgent(auth.get(), getProviders())

// Fora de componente: a conta do grupo, ou nada se ela foi removida (ver liveAccount).
export const getLiveAccount = (id?: string): string | undefined => liveAccount(auth.get(), getProviders(), id)

// A mesma coisa num componente, acompanhando as listas de contas.
export function useLiveAccount(id?: string): string | undefined {
  return liveAccount(useStore(auth), useProviders(), id)
}

// Nulo até o processo principal responder.
export function useAuth(): AuthState | null {
  return useStore(auth)
}
