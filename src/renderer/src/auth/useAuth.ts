import { createContext, useContext, useSyncExternalStore } from 'react'
import { MAIN_ACCOUNT, type AuthState, type ClaudeAccount } from '../../../shared/auth'

// Contas do Claude Code e o login em andamento, acompanhando o processo principal. Um estado só
// para a janela inteira: a etiqueta de cada grupo, o uso e as configurações leem daqui.
let state: AuthState | null = null
const listeners = new Set<() => void>()

function set(next: AuthState): void {
  state = next
  listeners.forEach((l) => l())
}

window.api.auth.state().then(set)
window.api.auth.onState(set)

export function getAuth(): AuthState | null {
  return state
}

// Nulo até o processo principal responder.
export function useAuth(): AuthState | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state
  )
}

// A conta pedida, se ela ainda existe; senão (vazia ou removida), a padrão. É o que o processo
// principal faz ao abrir a conversa, então a tela mostra a mesma conta que vai rodar.
export function resolveAccount(auth: AuthState | null, id?: string): string {
  if (!auth) return id ?? MAIN_ACCOUNT
  return id && auth.accounts.some((a) => a.id === id) ? id : auth.defaultId
}

export function findAccount(auth: AuthState | null, id?: string): ClaudeAccount | undefined {
  const resolved = resolveAccount(auth, id)
  return auth?.accounts.find((a) => a.id === resolved)
}

// Conta da conversa na tela (a do grupo da pasta, ainda sem resolver). Os seletores lá dentro
// pegam os modelos dela.
export const AccountContext = createContext<string | undefined>(undefined)

export function useConversationAccount(): string | undefined {
  return useContext(AccountContext)
}
