import type { AuthState } from '../../../shared/auth'
import { createStore } from '../lib/createStore'
import { useStore } from '../lib/useStore'

// Os de fora importam daqui (canvas, conversa): as peças moram em arquivos próprios.
export { findAccount, resolveAccount } from './accounts'
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

// Nulo até o processo principal responder.
export function useAuth(): AuthState | null {
  return useStore(auth)
}
