import { MAIN_ACCOUNT, type AuthState, type ClaudeAccount } from '../../../../shared/auth'
import { findAccount } from '../../auth/accounts'

const PROVIDERS: Record<string, string> = {
  bedrock: 'Amazon Bedrock',
  vertex: 'Google Vertex AI',
  foundry: 'Microsoft Foundry',
  gateway: 'gateway da empresa'
}

// O que o card de uma conta mostra, tirado do estado das contas.
export type AccountSummary = {
  // Mais de uma conta: aparecem as etiquetas Principal e Padrão e o "Usar como padrão".
  multiple: boolean
  main: boolean
  isDefault: boolean
  loggedIn: boolean
  // Acesso de fora (Bedrock, Vertex, gateway): não há login para trocar.
  external: boolean
  // E-mail, ou o provedor de fora.
  who: string
  // Rodapé, à esquerda das ações: organização e plano.
  footer: string
  // Quem passa a valer nos grupos desta conta, se ela sair.
  fallback?: string
}

export function accountSummary(account: ClaudeAccount, auth: AuthState): AccountSummary {
  const isDefault = auth.defaultId === account.id
  const s = account.status
  const loggedIn = !!s?.loggedIn
  const external = !!s?.provider && s.provider !== 'firstParty'
  const plan = s?.subscriptionType && s.subscriptionType[0].toUpperCase() + s.subscriptionType.slice(1)
  // A organização automática de conta pessoal ("Fulano's Organization") não diz nada e fica de fora.
  const org = s?.organization && !/'s organi[sz]ation$/i.test(s.organization) ? s.organization : null
  return {
    multiple: auth.accounts.length > 1,
    main: account.id === MAIN_ACCOUNT,
    isDefault,
    loggedIn,
    external,
    who: s?.email ?? (external ? (PROVIDERS[s.provider!] ?? s.provider!) : 'Conta conectada'),
    footer: loggedIn ? [org, plan && `Plano ${plan}`, s?.method === 'console' && 'Anthropic Console'].filter(Boolean).join(' - ') : '',
    fallback: isDefault ? auth.accounts.find((a) => a.id === MAIN_ACCOUNT)?.name : findAccount(auth)?.name
  }
}
