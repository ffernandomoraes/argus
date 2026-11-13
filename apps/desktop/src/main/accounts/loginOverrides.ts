import { MAIN_ACCOUNT } from '@argus/shared/auth'

// Variáveis de ambiente que o Claude Code usa no lugar do login guardado (pela ordem dele, as três
// vencem o /login). Numa conta extra, a conta escolhida é o login dela: com uma dessas no ambiente
// em que o app abriu, toda conversa gastaria a mesma credencial, qualquer que fosse a conta. A
// principal segue como o `claude` do terminal, que também as usa. (O NodeTerm e o cc-switch tiram
// as mesmas.) No Windows o nome da variável pode vir com outra caixa.
const LOGIN_OVERRIDES = /^(ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN|CLAUDE_CODE_OAUTH_TOKEN)$/i

// A variável trocaria o login desta conta? Só nas contas extras.
export const overridesLogin = (name: string, account: string): boolean => account !== MAIN_ACCOUNT && LOGIN_OVERRIDES.test(name)

// Tira do ambiente o que trocaria o login da conta.
export function dropLoginOverrides<T extends Record<string, unknown>>(env: T, account: string): T {
  for (const key of Object.keys(env)) if (overridesLogin(key, account)) delete env[key]
  return env
}
