import type { Account } from '@argus/shared/auth'
import type { Stored, StoredState } from '../claudeAuth/store'

// Respostas do `claude` sobre o login, no formato do app. Lógica pura, sem rodar nada.

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)

// O que `claude auth status --json` responde. Lança se não for JSON. userName: o nome da pessoa
// para o e-mail da conta (o comando não traz; ver status.ts).
export function parseAuthStatus(stdout: string, userName: (email: string | undefined) => string | undefined): Account {
  const s = JSON.parse(stdout) as Record<string, unknown>
  // Até quando o login vale (loginExpiresAt, uma data ISO; nulo nos logins sem prazo).
  const endsAt = s.loggedIn === true ? Date.parse(str(s.loginExpiresAt) ?? '') : NaN
  return {
    loggedIn: s.loggedIn === true,
    method: str(s.authMethod),
    provider: str(s.apiProvider),
    email: str(s.email),
    userName: s.loggedIn === true ? userName(str(s.email)) : undefined,
    organization: str(s.orgName),
    subscriptionType: str(s.subscriptionType),
    ...(Number.isFinite(endsAt) && { loginEndsAt: endsAt })
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

// O que o login guardado da conta, lido logo depois do `auth status`, diz sobre a resposta dele. É só
// uma pista: quem decide se a conta está logada é sempre o Claude Code (o login pode nem estar nesse
// arquivo, como no cofre de credenciais do Windows), nunca o arquivo. Só no login do claude.ai: com
// chave de API ou token do ambiente, o login guardado não é o que vale.
// - confirm: o guardado está apagado. Com o login vencido, o próprio `auth status` renova; se a
//   renovação é recusada, o Claude Code apaga o login e mesmo assim responde loggedIn: true (medido na
//   2.1.322; só a chamada seguinte diz false). Perguntar de novo, e vale a segunda resposta. Sem
//   isso, a conta aparecia conectada e a conversa respondia sem login.
// - renewing: o guardado segue vencido. A renovação não aconteceu neste `auth status` (outro `claude`
//   da conta segurava a trava da renovação e ele desistiu, medido na 2.1.322) e ainda vai acontecer,
//   dando certo ou apagando o login: conferir de novo logo depois (ver Auth.settle). Visto na
//   abertura do app, com duas conferências seguidas: a segunda respondia "logada" e lia o arquivo
//   antes de a primeira apagá-lo.
// - final: vale o que o `auth status` disse (inclusive com o arquivo ausente ou ilegível).
export type StoredHint = 'final' | 'confirm' | 'renewing'

export function storedHint(account: Account, stored: Stored | null, state: StoredState, now: number): StoredHint {
  if (!account.loggedIn || account.method !== 'claude.ai') return 'final'
  if (state === 'ended') return 'confirm'
  const expiresAt = stored?.claudeAiOauth?.expiresAt
  return state === 'ok' && typeof expiresAt === 'number' && expiresAt > 0 && expiresAt <= now ? 'renewing' : 'final'
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

// E-mail do login no .claude.json da conta (o mesmo oauthAccount de userNameFrom), sem rodar o
// `claude`: só para conferir de quem é o uso guardado na abertura (ver usageMonitor/saved.ts).
export function emailFrom(config: unknown): string | undefined {
  return str((config as { oauthAccount?: Record<string, unknown> } | null)?.oauthAccount?.emailAddress)
}
