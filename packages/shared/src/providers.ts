// Agentes além do Claude Code (Codex, Gemini CLI, Antigravity CLI, Cursor CLI): instalação e contas.
// O Claude continua com o tipo dele (auth.ts); a tela de Contas junta os dois.

export type ProviderId = 'codex' | 'gemini' | 'antigravity' | 'cursor';

export const PROVIDERS: ProviderId[] = ['codex', 'gemini', 'antigravity', 'cursor'];

export const PROVIDER_NAMES: Record<ProviderId, string> = {
  codex: 'Codex',
  gemini: 'Gemini',
  antigravity: 'Antigravity',
  cursor: 'Cursor',
};

// Versão mais antiga de cada CLI que o Argus consegue usar. Antigravity: o `agy acp` nasceu na 1.5.0.
export const MIN_VERSIONS: Partial<Record<ProviderId, string>> = { antigravity: '1.5.0' };

// login: entra pelo navegador, pelo próprio CLI (Codex; a principal do Cursor e do Antigravity).
// key: chave de API guardada no cofre do sistema (Gemini; as outras do Cursor e do Antigravity).
// Ver apps/desktop/src/main/providers/.
export type AccountKind = 'login' | 'key';

// A principal de cada agente é a do terminal (~/.codex, ~/.cursor). As outras moram em pastas do app.
export const MAIN_PROVIDER_ACCOUNT = 'main';

export type ProviderAccountStatus = {
  signedIn: boolean
  email?: string
  // Plano da conta, quando o CLI informa (ChatGPT Plus, Pro...).
  plan?: string
  // Chave: os últimos caracteres, para reconhecer qual é.
  keyHint?: string
};

export type ProviderAccount = {
  id: string
  provider: ProviderId
  kind: AccountKind
  name: string
  customName: boolean
  // Nulo enquanto confere, ou sem o CLI instalado.
  status: ProviderAccountStatus | null
};

// found: achado (path). missing: não instalado. installing/failed: o Argus rodando o instalador
// oficial; `command` é o mesmo instalador, para rodar à mão. outdated: instalado numa versão que o
// Argus não consegue usar (`version`); `command` é o que atualiza. updating: o `installing` é uma
// atualização.
export type ProviderInstall = {
  status: 'found' | 'missing' | 'installing' | 'failed' | 'outdated'
  version?: string
  updating?: boolean
  message?: string
  command: string
};

// waiting: navegador aberto, esperando a pessoa terminar (url para abrir de novo; code no login
// por código). key: esperando a chave (a página dela foi aberta). checking: testando a chave.
export type ProviderLogin =
  | { status: 'idle' }
  | { status: 'waiting'; provider: ProviderId; accountId: string; adding: boolean; url?: string; code?: string }
  | { status: 'key'; provider: ProviderId; accountId: string; adding: boolean }
  | { status: 'checking'; provider: ProviderId; accountId: string; adding: boolean }
  // kind: o que falhou, o login pelo navegador ou a chave (a tela da chave deixa tentar outra).
  | { status: 'error'; provider: ProviderId; accountId: string; adding: boolean; kind: AccountKind; message: string };

export type ProviderState = {
  install: ProviderInstall
  // A principal primeiro (quando existe), depois as outras na ordem em que entraram.
  accounts: ProviderAccount[]
  defaultId: string | null
};

export type ProvidersState = {
  providers: Record<ProviderId, ProviderState>
  login: ProviderLogin
};

// Agentes que aceitam conta por chave de API.
export type KeyProviderId = Exclude<ProviderId, 'codex'>;

// Página onde a pessoa cria a chave. O Antigravity usa a mesma chave do Gemini.
export const KEY_PAGES: Record<KeyProviderId, string> = {
  gemini: 'https://aistudio.google.com/apikey',
  antigravity: 'https://aistudio.google.com/apikey',
  cursor: 'https://cursor.com/dashboard?tab=integrations',
};

// Chave de API achada na área de transferência: só o final dela vai para a tela.
export type ClipboardKey = { provider: ProviderId; hint: string } | null;

// Agente + conta de um grupo do canvas, no mesmo campo da conta do Claude (`account`), para passar
// por todo o caminho que ela já faz (grupo, conversa, janela avulsa): "codex:main",
// "gemini:ab12cd34". As contas do Claude ("main" ou 8 letras/números) nunca têm dois-pontos.
export type AgentRef = { provider: ProviderId; account: string };

export const agentRef = (provider: ProviderId, account: string) => `${provider}:${account}`;

export function parseAgentRef(account?: string): AgentRef | null {
  const m = account ? /^(codex|gemini|antigravity|cursor):([a-z0-9]+)$/.exec(account) : null;
  return m ? { provider: m[1] as ProviderId, account: m[2] } : null;
}
