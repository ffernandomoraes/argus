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
  // Nome da pessoa na conta da Anthropic. Não vem do `auth status`: o Argus lê do .claude.json.
  userName?: string
  organization?: string
  subscriptionType?: string
  // Até quando o login vale (ms), como o `auth status` informa (loginExpiresAt): nos planos com prazo
  // de sessão, renovar não adia essa data, e passada ela o Claude Code apaga o login ("this login
  // reached its time limit"; conferido na 2.1.322). Ausente: sem prazo conhecido.
  loginEndsAt?: number
}

// Faltando menos que isso para o login terminar, o app avisa (cartão da conta e painel dos limites).
export const LOGIN_WARN_MS = 2 * 24 * 60 * 60_000

// O login da conta termina logo (ou já passou do prazo)? Só com login e prazo conhecido.
export function loginEndingSoon(status: Account | null | undefined, now: number): boolean {
  return !!status?.loggedIn && !!status.loginEndsAt && status.loginEndsAt - now < LOGIN_WARN_MS
}

// A principal é a conta do ~/.claude, a mesma do terminal e do VS Code. As outras moram cada uma
// numa pasta própria, com login separado e o resto ligado à principal (ver apps/desktop/src/main/accounts/).
export const MAIN_ACCOUNT = 'main'

// Login da conta dentro de uma distro do WSL (Argus no Windows), separado do login do Windows: é o
// que as conversas e os terminais das pastas daquela distro usam. status nulo: ainda conferindo, ou
// o `claude` de lá não respondeu.
export type WslLogin = { distro: string; status: Account | null }

export type ClaudeAccount = {
  id: string
  // Apelido escolhido ou, sem ele, o sugerido pela conta (nome da pessoa, da organização ou "Pessoal").
  name: string
  customName: boolean
  // Pasta da conta; só nas que não são a principal. No terminal: CLAUDE_CONFIG_DIR=<pasta> claude.
  dir?: string
  // Nulo enquanto confere, ou se o `claude` não rodou (não instalado).
  status: Account | null
  // Só no Windows com o Claude Code instalado também numa distro do WSL que não é a do app.
  wsl?: WslLogin[]
  // Como a conta entrou da última vez; ausente se o app ainda não a viu logada, ou se a pessoa saiu
  // dela pelo app (ver lostLogin).
  loginMethod?: LoginMethod
}

// Como entrar de novo numa conta: do mesmo jeito da última vez; sem saber, pela assinatura do Claude.
export const reloginMethod = (account: Pick<ClaudeAccount, 'loginMethod'>): LoginMethod => account.loginMethod ?? 'claudeai'

// A conta perdeu o login: está sem login e ninguém saiu dela pelo app. As extras só existem para
// serem usadas (entram na lista já logadas), então sem login é login perdido. A principal, só se o
// app já a viu logada: sair pelo app tira a marca, e a conta não fica cobrando um login que a
// pessoa não quer.
export function lostLogin(account: Pick<ClaudeAccount, 'id' | 'status' | 'loginMethod'>): boolean {
  return account.status?.loggedIn === false && (account.id !== MAIN_ACCOUNT || !!account.loginMethod)
}

// starting: pedindo o link ao `claude`. waiting: navegador aberto, esperando a pessoa terminar.
// adding: conta nova, que só entra na lista quando o login termina.
// distro: o login é o da conta dentro daquela distro do WSL (ver WslLogin).
type LoginTarget = { accountId: string; adding: boolean; distro?: string }

export type LoginState =
  | { status: 'idle' }
  | ({ status: 'starting'; method: LoginMethod } & LoginTarget)
  | ({ status: 'waiting'; method: LoginMethod; automaticUrl: string; manualUrl: string } & LoginTarget)
  | ({ status: 'error'; message: string } & LoginTarget)

// O `claude` desta máquina. missing: não achado (a tela de boas-vindas oferece instalar).
// installing: o Argus está rodando o instalador oficial. failed: deu erro (message); `command` é o
// mesmo instalador, para rodar na mão no terminal.
export type ClaudeInstall = {
  status: 'found' | 'missing' | 'installing' | 'failed'
  message?: string
  command: string
  // Windows: o Git for Windows, que o Claude Code usa para rodar comandos. Sempre true no Mac.
  git: boolean
}

export type AuthState = {
  claude: ClaudeInstall
  // A principal primeiro; as outras na ordem em que foram adicionadas.
  accounts: ClaudeAccount[]
  // Usada fora de grupo e nos grupos sem conta escolhida.
  defaultId: string
  login: LoginState
}
