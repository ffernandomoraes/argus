import { MAIN_ACCOUNT, type AuthState, type ClaudeAccount } from '../../../shared/auth'
import { agentRef, parseAgentRef, PROVIDERS, type ProvidersState } from '../../../shared/providers'

// A conta pedida, se ela ainda existe; senão (vazia ou removida), a padrão. É o que o processo
// principal faz ao abrir a conversa, então a tela mostra a mesma conta que vai rodar.
// Conta de outro agente ("codex:main") passa como veio: quem confere é o processo principal.
export function resolveAccount(auth: AuthState | null, id?: string): string {
  if (parseAgentRef(id)) return id!
  if (!auth) return id ?? MAIN_ACCOUNT
  return id && auth.accounts.some((a) => a.id === id) ? id : auth.defaultId
}

export function findAccount(auth: AuthState | null, id?: string): ClaudeAccount | undefined {
  const resolved = resolveAccount(auth, id)
  return auth?.accounts.find((a) => a.id === resolved)
}

// Claude Code instalado e nenhuma conta confirmada sem login. Conta que não respondeu (null) não
// conta como sem login: é a mesma regra para abrir o canvas.
export function claudeReady(auth: AuthState): boolean {
  const loggedOut = !!auth.accounts.length && auth.accounts.every((a) => a.status?.loggedIn === false)
  return auth.claude.status === 'found' && !loggedOut
}

// Sem o Claude pronto, o agente que roda fora de grupo (e nos grupos sem agente escolhido): o
// primeiro outro agente com a conta padrão conectada ("codex:main").
export function fallbackAgent(auth: AuthState | null, providers: ProvidersState | null): string | undefined {
  if (!auth || !providers || claudeReady(auth)) return undefined
  for (const p of PROVIDERS) {
    const { accounts, defaultId } = providers.providers[p]
    const chosen = accounts.find((a) => a.id === defaultId && a.status?.signedIn) ?? accounts.find((a) => a.status?.signedIn)
    if (chosen) return agentRef(p, chosen.id)
  }
  return undefined
}
