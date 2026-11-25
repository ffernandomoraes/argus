import type { ClaudeAction, ClaudeItem } from './accountClaude';
import type { GitHubConnectResult, GitHubInstallationList, GitHubRepoList, GitHubStatus } from './accountGitHub';
import type { RendererSyncValues } from './accountSync';
import type { AccountComputer, WorkspaceImportResult } from './accountWorkspaces';

// Conta do Argus: login com GitHub ou Google e as preferências sincronizadas entre computadores. O
// servidor fica em apps/account (account.argusterm.com); o login e a sincronização, em
// apps/desktop/src/main/account. Não tem nada a ver com as contas do Claude (aba Contas).

export type AccountProvider = 'github' | 'google';
export const ACCOUNT_PROVIDERS: readonly AccountProvider[] = ['github', 'google'];

export type AccountIdentity = { provider: AccountProvider; login: string | null; email: string | null };

export type AccountProfile = {
  id: string
  name: string
  email: string | null
  // Foto já baixada (data:), porque a janela só mostra imagens locais. Nula: mostra as iniciais.
  avatar: string | null
  // Logins ligados a esta conta (o mesmo e-mail confirmado no GitHub e no Google vira uma conta só).
  identities: AccountIdentity[]
};

export type AccountDevice = {
  id: string
  name: string
  // darwin, win32, linux ou other.
  platform: string
  lastSeenAt: number
  // O computador de onde se está olhando.
  current: boolean
};

export type AccountSync = {
  // syncing: pedido em andamento; error: o último falhou (sem rede, servidor fora) e tenta de novo
  // sozinho mais tarde.
  status: 'idle' | 'syncing' | 'error'
  lastSyncedAt: number | null
  // Primeira sincronização deste computador nesta abertura do app: trouxe as preferências da conta
  // (já havia outro computador) ou mandou as daqui (primeiro computador da conta).
  first: 'adopted' | 'uploaded' | null
};

// Por que o login não deu certo ou a sessão acabou, para a tela explicar.
export type AccountError = 'denied' | 'failed' | 'expired' | 'offline' | 'revoked';

export type AccountState =
  | { status: 'signedOut'; error: AccountError | null }
  | { status: 'signingIn'; provider: AccountProvider }
  | { status: 'signedIn'; profile: AccountProfile; sync: AccountSync };

export type AccountInvokeChannels = {
  'account:state': () => AccountState
  // Nulo: não deu para buscar (sem rede).
  'account:devices': () => AccountDevice[] | null
  'account:removeDevice': (id: string) => boolean
  // Apaga a conta no servidor e sai daqui. Falso: não deu (sem rede).
  'account:delete': () => boolean
  // Os outros computadores da conta e os workspaces deles. Nulo: não deu para buscar.
  'account:computers': () => AccountComputer[] | null
  'account:importWorkspace': (computerId: string, boardId: string) => WorkspaceImportResult
  // Arquivos do Claude na conta, já comparados com os daqui. Nulo: não deu (sem rede).
  'account:claudeItems': () => ClaudeItem[] | null
  'account:claudeAct': (action: ClaudeAction, keys: string[]) => ClaudeItem[] | null
  // GitHub conectado à conta, para clonar (ver accountGitHub.ts). O connect espera a volta do
  // navegador (até 10 minutos).
  'account:github': () => GitHubStatus
  'account:githubConnect': () => GitHubConnectResult
  'account:githubRepos': () => GitHubRepoList
  'account:githubInstallations': () => GitHubInstallationList
  'account:githubDisconnect': () => boolean
};

export type AccountSendChannels = {
  'account:signIn': (provider: AccountProvider) => void
  'account:cancelSignIn': () => void
  'account:signOut': () => void
  'account:syncNow': () => void
  'account:githubCancel': () => void
  // As preferências da janela que sincronizam, contadas ao abrir e a cada mudança (ver accountSync.ts).
  'account:reportPrefs': (prefs: RendererSyncValues) => void
};

export type AccountEventChannels = {
  'account:state': (state: AccountState) => void
  // Preferências da janela que vieram da conta: a janela aplica.
  'account:applyPrefs': (prefs: RendererSyncValues) => void
};
