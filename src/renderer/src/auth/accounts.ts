import { MAIN_ACCOUNT, type AuthState, type ClaudeAccount } from '../../../shared/auth'

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
