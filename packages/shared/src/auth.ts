// Assinatura do claude.ai ou cobrança por uso da API pelo Anthropic Console.
export type LoginMethod = 'claudeai' | 'console';

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
  // Identificadores fixos da conta do Claude e da organização: o e-mail e o nome da organização podem
  // mudar, eles não. accountUuid não vem do `auth status`: o Argus lê do .claude.json (oauthAccount);
  // organizationId é o orgId do `auth status`. É por eles que o app sabe que dois logins são a mesma
  // conta (ver sameIdentity).
  accountUuid?: string
  organizationId?: string
  subscriptionType?: string
  // Até quando o login vale (ms), como o `auth status` informa (loginExpiresAt): nos planos com prazo
  // de sessão, renovar não adia essa data, e passada ela o Claude Code apaga o login ("this login
  // reached its time limit"; conferido na 2.1.322). Ausente: sem prazo conhecido.
  loginEndsAt?: number
};

// Faltando menos que isso para o login terminar, o app avisa (cartão da conta e painel dos limites).
export const LOGIN_WARN_MS = 2 * 24 * 60 * 60_000;

// O login da conta termina logo (ou já passou do prazo)? Só com login e prazo conhecido.
export function loginEndingSoon(status: Account | null | undefined, now: number): boolean {
  return !!status?.loggedIn && !!status.loginEndsAt && status.loginEndsAt - now < LOGIN_WARN_MS;
}

// A principal é a conta do ~/.claude, a mesma do terminal e do VS Code. As outras moram cada uma
// numa pasta própria, com login separado e o resto ligado à principal (ver apps/desktop/src/main/accounts/).
export const MAIN_ACCOUNT = 'main';

// Login da conta dentro de uma distro do WSL (Argus no Windows), separado do login do Windows: é o
// que as conversas e os terminais das pastas daquela distro usam. status nulo: ainda conferindo, ou
// o `claude` de lá não respondeu.
export type WslLogin = { distro: string; status: Account | null };

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
};

// Como entrar de novo numa conta: do mesmo jeito da última vez; sem saber, pela assinatura do Claude.
export const reloginMethod = (account: Pick<ClaudeAccount, 'loginMethod'>): LoginMethod => account.loginMethod ?? 'claudeai';

// A conta perdeu o login: está sem login e ninguém saiu dela pelo app. As extras só existem para
// serem usadas (entram na lista já logadas), então sem login é login perdido. A principal, só se o
// app já a viu logada: sair pelo app tira a marca, e a conta não fica cobrando um login que a
// pessoa não quer.
export function lostLogin(account: Pick<ClaudeAccount, 'id' | 'status' | 'loginMethod'>): boolean {
  return account.status?.loggedIn === false && (account.id !== MAIN_ACCOUNT || !!account.loginMethod);
}

// De quem é um login: o que o app guarda de cada conta (accounts.json) para reconhecê-la mesmo
// depois de o login cair.
export type LoginIdentity = Pick<Account, 'accountUuid' | 'organizationId' | 'email' | 'organization'>;

// A identidade do login da conta; nada sem login ou sem nada que identifique (chave de API e afins).
export function loginIdentity(account: Account | null | undefined): LoginIdentity | undefined {
  if (!account?.loggedIn || (!account.accountUuid && !account.email)) return undefined;
  const { accountUuid, organizationId, email, organization } = account;
  return { ...(accountUuid && { accountUuid }), ...(organizationId && { organizationId }), ...(email && { email }), ...(organization && { organization }) };
}

// Os dois logins são da mesma conta do Claude? Pelos identificadores fixos quando os dois têm; o
// e-mail e o nome da organização só valem na falta deles (versão antiga do Claude Code, .claude.json
// ilegível). A organização entra: a mesma pessoa pode ter o plano pessoal e o da empresa.
export function sameIdentity(a: LoginIdentity | null | undefined, b: LoginIdentity | null | undefined): boolean {
  if (!a || !b) return false;
  const sameOrg = a.organizationId && b.organizationId ? a.organizationId === b.organizationId : a.organization === b.organization;
  if (a.accountUuid && b.accountUuid) return a.accountUuid === b.accountUuid && sameOrg;
  return !!a.email && a.email === b.email && sameOrg;
}

// As duas contas do app estão com o mesmo login do Claude? Só com login nas duas.
export function sameLogin(a: Account | null | undefined, b: Account | null | undefined): boolean {
  return !!a?.loggedIn && !!b?.loggedIn && sameIdentity(loginIdentity(a), loginIdentity(b));
}

// Conta que saiu da lista por ter o mesmo login de outra (ver AuthState.mergedInto): devolve a que
// ficou no lugar dela, seguindo a cadeia (a que ficou pode ter sido juntada depois). Sem troca, o id
// como veio.
export function followMerged(mergedInto: Record<string, string> | undefined, id: string): string {
  let current = id;
  // O limite só protege de um arquivo com volta (a -> b -> a).
  for (let i = 0; i < 8 && mergedInto && current in mergedInto; i++) current = mergedInto[current];
  return current;
}

// Aviso de contas juntadas, até a pessoa fechar: os nomes como apareciam na lista.
export type MergeNotice = { kept: string; removed: string[] };

// starting: pedindo o link ao `claude`. waiting: navegador aberto, esperando a pessoa terminar.
// adding: conta nova, que só entra na lista quando o login termina.
// distro: o login é o da conta dentro daquela distro do WSL (ver WslLogin).
type LoginTarget = { accountId: string; adding: boolean; distro?: string };

export type LoginState =
  | { status: 'idle' }
  | ({ status: 'starting'; method: LoginMethod } & LoginTarget)
  | ({ status: 'waiting'; method: LoginMethod; automaticUrl: string; manualUrl: string } & LoginTarget)
  | ({ status: 'error'; message: string } & LoginTarget);

// O `claude` desta máquina. missing: não achado (a tela de boas-vindas oferece instalar).
// installing: o Argus está rodando o instalador oficial. failed: deu erro (message); `command` é o
// mesmo instalador, para rodar na mão no terminal.
export type ClaudeInstall = {
  status: 'found' | 'missing' | 'installing' | 'failed'
  message?: string
  command: string
  // Windows: o Git for Windows, que o Claude Code usa para rodar comandos. Sempre true no Mac.
  git: boolean
};

export type AuthState = {
  claude: ClaudeInstall
  // A principal primeiro; as outras na ordem em que foram adicionadas.
  accounts: ClaudeAccount[]
  // Usada fora de grupo e nos grupos sem conta escolhida.
  defaultId: string
  login: LoginState
  // Contas que saíram da lista por terem o mesmo login de outra, e a que ficou no lugar de cada uma:
  // o grupo que guardava a conta removida passa a usar a que ficou (ver followMerged).
  mergedInto?: Record<string, string>
  mergeNotice?: MergeNotice
};
