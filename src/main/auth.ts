import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import { promisify } from 'node:util'
import { shell } from 'electron'
import { query, type Query } from '@anthropic-ai/claude-agent-sdk'
import { MAIN_ACCOUNT, type Account, type AuthState, type ClaudeInstall, type LoginMethod, type LoginState } from '../shared/auth'
import {
  accountDir,
  accountIds,
  addAccount,
  createPendingAccount,
  customName,
  defaultAccount,
  discardAccount,
  removeAccount,
  renameAccount,
  setDefaultAccount,
  suggestedName
} from './accounts'
import { claudeEnv, Inbox } from './chats'
import { claudeCommand, claudeFound, claudePath } from './claudePath'
import { INSTALL_COMMAND, runClaudeInstaller } from './claudeInstall'

// Mesmo caminho da extensão do VS Code: um `claude` aberto só para o login gera o link,
// recebe o retorno do navegador e grava o login, nas Chaves do macOS (no Windows, num arquivo da
// pasta de configuração). Na principal, onde o Claude Code inteiro (terminal, VS Code, este app)
// passa a usar; nas outras, no item da pasta da conta (ver accounts.ts).

const run = promisify(execFile)

// Comando do `claude` fora do SDK. windowsHide: sem ele, o Windows pisca uma janela de terminal a
// cada conferência de login.
function runClaude(claude: string, args: string[], account: string) {
  const cmd = claudeCommand(args, claude)
  return run(cmd.file, cmd.args, { env: claudeEnv(claude, account), timeout: 15_000, windowsHide: true })
}

// O SDK tem os pedidos de login, mas não os publica nos tipos. Conferido na 0.3.289.
type LoginQuery = Query & {
  claudeAuthenticate(loginWithClaudeAi: boolean): Promise<{ manualUrl: string; automaticUrl: string }>
  claudeOAuthCallback(authorizationCode: string, state: string): Promise<unknown>
  claudeOAuthWaitForCompletion(): Promise<unknown>
}

async function readAccount(id: string): Promise<Account | null> {
  const claude = claudePath()
  try {
    const { stdout } = await runClaude(claude, ['auth', 'status', '--json'], id)
    const s = JSON.parse(stdout) as Record<string, unknown>
    const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
    return {
      loggedIn: s.loggedIn === true,
      method: str(s.authMethod),
      provider: str(s.apiProvider),
      email: str(s.email),
      organization: str(s.orgName),
      subscriptionType: str(s.subscriptionType)
    }
  } catch (err) {
    // Sem login o comando sai com erro, mas ainda responde o JSON.
    const stdout = (err as { stdout?: string }).stdout
    if (stdout?.includes('"loggedIn"')) {
      try {
        return { loggedIn: (JSON.parse(stdout) as { loggedIn?: boolean }).loggedIn === true }
      } catch {
        // cai no aviso abaixo
      }
    }
    console.warn('[auth] claude auth status falhou:', (err as Error).message)
    return null
  }
}

// adding: conta nova, cuja pasta some se o login não terminar.
type LoginSession = { q: LoginQuery; inbox: Inbox; accountId: string; adding: boolean }

export class Auth {
  private statuses = new Map<string, Account | null>()
  private loginState: LoginState = { status: 'idle' }
  private install: ClaudeInstall = { status: claudeFound() ? 'found' : 'missing', command: INSTALL_COMMAND }
  private session: LoginSession | null = null
  state: AuthState

  constructor(
    private onState: (state: AuthState) => void,
    // Entrou ou saiu de uma conta: o que roda com o login antigo dela precisa recomeçar.
    private onAccountChanged: (id: string) => void,
    // Conta removida: o que roda com ela é encerrado antes de a pasta sumir.
    private onAccountRemoved: (id: string) => void
  ) {
    this.state = this.build()
  }

  private build(): AuthState {
    const taken = new Set<string>()
    const accounts = accountIds().map((id) => {
      const status = this.statuses.get(id) ?? null
      const custom = customName(id)
      const name = custom ?? suggestedName(id, status, taken)
      taken.add(name)
      return { id, name, customName: !!custom, dir: accountDir(id), status }
    })
    return { claude: this.install, accounts, defaultId: defaultAccount(), login: this.loginState }
  }

  private emit(): void {
    this.state = this.build()
    this.onState(this.state)
  }

  private setLogin(login: LoginState): void {
    this.loginState = login
    this.emit()
  }

  // Confere de novo o login de uma conta ou, sem ela, de todas.
  async refresh(id?: string): Promise<void> {
    // Instalado por fora (no terminal) enquanto o app estava aberto, ou desinstalado.
    if (this.install.status !== 'installing') {
      if (claudeFound()) this.install = { status: 'found', command: INSTALL_COMMAND }
      else if (this.install.status === 'found') this.install = { status: 'missing', command: INSTALL_COMMAND }
    }
    const ids = id ? [id] : accountIds()
    const found = await Promise.all(ids.map(readAccount))
    ids.forEach((a, i) => this.statuses.set(a, found[i]))
    this.emit()
  }

  // Claude Code não achado: roda o instalador oficial e confere as contas de novo. Com um login já
  // guardado na máquina, o app entra direto.
  async installClaude(): Promise<void> {
    if (this.install.status === 'installing') return
    this.install = { status: 'installing', command: INSTALL_COMMAND }
    this.emit()
    const error = await runClaudeInstaller()
    this.install = claudeFound()
      ? { status: 'found', command: INSTALL_COMMAND }
      : {
          status: 'failed',
          command: INSTALL_COMMAND,
          message: error ?? 'O instalador terminou, mas o Claude Code não apareceu na pasta esperada.'
        }
    await this.refresh()
  }

  // Entra de novo numa conta da lista, ou em outra no lugar dela.
  login(accountId: string, method: LoginMethod): void {
    if (!accountIds().includes(accountId)) return
    void this.start(accountId, false, method)
  }

  // Conta nova: ganha a pasta agora e só entra na lista quando o login termina.
  add(method: LoginMethod): void {
    this.stop()
    void this.start(createPendingAccount(), true, method)
  }

  private async start(accountId: string, adding: boolean, method: LoginMethod): Promise<void> {
    this.stop()
    const claude = claudePath()
    const inbox = new Inbox()
    const q = query({
      prompt: inbox,
      options: {
        cwd: homedir(),
        pathToClaudeCodeExecutable: claude,
        env: claudeEnv(claude, accountId),
        settingSources: [],
        strictMcpConfig: true,
        persistSession: false,
        canUseTool: async () => ({ behavior: 'deny', message: 'Só login' })
      }
    }) as LoginQuery
    const session: LoginSession = { q, inbox, accountId, adding }
    this.session = session
    const current = () => this.session === session
    const target = { accountId, adding }
    this.setLogin({ status: 'starting', method, ...target })

    try {
      const { manualUrl, automaticUrl } = await q.claudeAuthenticate(method === 'claudeai')
      if (!current()) return
      // Pede antes de abrir o navegador, para não perder um retorno rápido.
      const done = q.claudeOAuthWaitForCompletion()
      this.setLogin({ status: 'waiting', method, automaticUrl, manualUrl, ...target })
      void shell.openExternal(automaticUrl)
      await done
      if (!current()) return
      // Confere a conta antes de sair da espera, para a tela não voltar às opções por um instante.
      const status = await readAccount(accountId)
      if (!current()) return
      if (adding) {
        const twin =
          status?.loggedIn &&
          this.state.accounts.find(
            (a) => a.status?.loggedIn && a.status.email === status.email && a.status.organization === status.organization
          )
        if (twin) {
          // A mesma conta duas vezes: a nova some com o login dela.
          this.stop()
          this.setLogin({ status: 'error', message: `essa conta já está no app, como "${twin.name}".`, ...target })
          return
        }
        addAccount(accountId)
      }
      this.statuses.set(accountId, status)
      this.stop(false)
      this.onAccountChanged(accountId)
      this.setLogin({ status: 'idle' })
    } catch (err) {
      if (!current()) return
      this.stop()
      this.setLogin({ status: 'error', message: (err as Error).message || 'Não deu para entrar.', ...target })
    }
  }

  // Código copiado da página do navegador, no formato "código#estado".
  submitCode(code: string): void {
    const s = this.session
    if (!s) return
    const [authorizationCode, state = ''] = code.trim().split('#')
    s.q.claudeOAuthCallback(authorizationCode, state).catch((err: Error) => {
      if (this.session === s) {
        this.setLogin({ status: 'error', message: err.message || 'Código recusado.', accountId: s.accountId, adding: s.adding })
      }
    })
  }

  cancel(): void {
    const busy = !!this.session || this.loginState.status !== 'idle'
    this.stop()
    if (busy) this.setLogin({ status: 'idle' })
  }

  // Sai da principal neste Mac, como o "Sign out" da extensão do VS Code: vale também para o
  // terminal e o VS Code.
  async logout(): Promise<boolean> {
    this.cancel()
    const claude = claudePath()
    let ok = true
    try {
      await runClaude(claude, ['auth', 'logout'], MAIN_ACCOUNT)
    } catch (err) {
      console.warn('[auth] claude auth logout falhou:', (err as Error).message)
      ok = false
    }
    await this.refresh(MAIN_ACCOUNT)
    this.onAccountChanged(MAIN_ACCOUNT)
    return ok
  }

  // Tira uma conta do app: sai dela e apaga o login guardado e a pasta. O que é seu continua na
  // principal, que nunca sai por aqui.
  async remove(id: string): Promise<boolean> {
    if (id === MAIN_ACCOUNT || !accountIds().includes(id)) return false
    if (this.session?.accountId === id) this.cancel()
    this.onAccountRemoved(id)
    const claude = claudePath()
    await runClaude(claude, ['auth', 'logout'], id).catch(() => {})
    removeAccount(id)
    this.statuses.delete(id)
    this.emit()
    return true
  }

  rename(id: string, name: string): void {
    if (!accountIds().includes(id)) return
    renameAccount(id, name)
    this.emit()
  }

  setDefault(id: string): void {
    setDefaultAccount(id)
    this.emit()
  }

  // Encerra o login em andamento. A conta nova que não chegou a entrar some junto, a não ser que
  // o login tenha acabado de dar certo (discard = false).
  private stop(discard = true): void {
    const s = this.session
    this.session = null
    if (!s) return
    s.inbox.close()
    s.q.close()
    if (s.adding && discard) discardAccount(s.accountId)
  }
}
