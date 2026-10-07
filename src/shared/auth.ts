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

// A principal é a conta do ~/.claude, a mesma do terminal e do VS Code. As outras moram cada uma
// numa pasta própria, com login separado e o resto ligado à principal (ver src/main/accounts.ts).
export const MAIN_ACCOUNT = 'main'

export type ClaudeAccount = {
  id: string
  // Apelido escolhido ou, sem ele, o sugerido pela conta (nome da organização ou "Pessoal").
  name: string
  customName: boolean
  // Pasta da conta; só nas que não são a principal. No terminal: CLAUDE_CONFIG_DIR=<pasta> claude.
  dir?: string
  // Nulo enquanto confere, ou se o `claude` não rodou (não instalado).
  status: Account | null
}

// starting: pedindo o link ao `claude`. waiting: navegador aberto, esperando a pessoa terminar.
// adding: conta nova, que só entra na lista quando o login termina.
type LoginTarget = { accountId: string; adding: boolean }

export type LoginState =
  | { status: 'idle' }
  | ({ status: 'starting'; method: LoginMethod } & LoginTarget)
  | ({ status: 'waiting'; method: LoginMethod; automaticUrl: string; manualUrl: string } & LoginTarget)
  | ({ status: 'error'; message: string } & LoginTarget)

export type AuthState = {
  // A principal primeiro; as outras na ordem em que foram adicionadas.
  accounts: ClaudeAccount[]
  // Usada fora de grupo e nos grupos sem conta escolhida.
  defaultId: string
  login: LoginState
}
