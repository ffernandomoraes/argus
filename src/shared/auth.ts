// Assinatura do claude.ai ou cobrança por uso da API pelo Anthropic Console.
export type LoginMethod = 'claudeai' | 'console'

// O que `claude auth status --json` responde.
export type Account = {
  loggedIn: boolean
  // "claude.ai", "console", "api-key"...; ausente sem login.
  method?: string
  // "firstParty" é o login da Anthropic; Bedrock, Vertex e Foundry vêm com o nome deles.
  provider?: string
  email?: string
  organization?: string
  subscriptionType?: string
}

// starting: pedindo o link ao `claude`. waiting: navegador aberto, esperando a pessoa terminar.
export type LoginState =
  | { status: 'idle' }
  | { status: 'starting'; method: LoginMethod }
  | { status: 'waiting'; method: LoginMethod; automaticUrl: string; manualUrl: string }
  | { status: 'error'; message: string }

export type AuthState = {
  // Nulo enquanto confere, ou se o `claude` não rodou (não instalado).
  account: Account | null
  login: LoginState
}
