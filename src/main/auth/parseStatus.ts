import type { Account } from '../../shared/auth'

// Respostas do `claude` sobre o login, no formato do app. Lógica pura, sem rodar nada.

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)

// O que `claude auth status --json` responde. Lança se não for JSON. userName: o nome da pessoa
// para o e-mail da conta (o comando não traz; ver status.ts).
export function parseAuthStatus(stdout: string, userName: (email: string | undefined) => string | undefined): Account {
  const s = JSON.parse(stdout) as Record<string, unknown>
  return {
    loggedIn: s.loggedIn === true,
    method: str(s.authMethod),
    provider: str(s.apiProvider),
    email: str(s.email),
    userName: s.loggedIn === true ? userName(str(s.email)) : undefined,
    organization: str(s.orgName),
    subscriptionType: str(s.subscriptionType)
  }
}

// Sem login o comando sai com erro, mas ainda responde o JSON: dele, só o loggedIn. null se a
// saída não for essa resposta.
export function parseFailedStatus(stdout: string | undefined): Account | null {
  if (!stdout?.includes('"loggedIn"')) return null
  try {
    return { loggedIn: (JSON.parse(stdout) as { loggedIn?: boolean }).loggedIn === true }
  } catch {
    return null
  }
}

// Nome da pessoa no .claude.json da conta (oauthAccount, fora do formato documentado: se mudar, o
// cartão só deixa de mostrar o nome). Só vale se o e-mail de lá for o da conta conectada, para
// nunca mostrar o nome de um login anterior.
export function userNameFrom(config: unknown, email: string | undefined): string | undefined {
  const a = (config as { oauthAccount?: Record<string, unknown> } | null)?.oauthAccount
  if (!a || !email || a.emailAddress !== email) return undefined
  const name = [a.displayName, a.fullName].find((v): v is string => typeof v === 'string' && !!v.trim())
  return name?.trim()
}
