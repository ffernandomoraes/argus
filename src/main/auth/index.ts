import { shell } from 'electron'
import { MAIN_ACCOUNT, type Account, type AuthState, type ClaudeInstall, type LoginMethod, type LoginState } from '../../shared/auth'
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
} from '../accounts'
import type { Inbox } from '../chats'
import { INSTALL_COMMAND, runClaudeInstaller } from '../claudeInstall'
import { claudeFound, claudePath, lookupClaude } from '../claudePath'
import { gitFound } from '../platform'
import { openLoginQuery, type LoginQuery } from './loginQuery'
import { readAccount, runClaude, type AccountRead } from './status'

// Mesmo caminho da extensão do VS Code: um `claude` aberto só para o login gera o link,
// recebe o retorno do navegador e grava o login, nas Chaves do macOS (no Windows, num arquivo da
// pasta de configuração). Na principal, onde o Claude Code inteiro (terminal, VS Code, este app)
// passa a usar; nas outras, no item da pasta da conta (ver accounts/).

// O Git é conferido junto: no Windows, a etapa de configuração mostra se falta.
function installState(status: ClaudeInstall['status'], message?: string): ClaudeInstall {
  return { status, message, command: INSTALL_COMMAND, git: gitFound() }
}

// adding: conta nova, cuja pasta some se o login não terminar.
type LoginSession = { q: LoginQuery; inbox: Inbox; accountId: string; adding: boolean }

export class Auth {
  private statuses = new Map<string, Account | null>()
  // Número da conferência mais recente de cada conta (ver settle).
  private checks = new Map<string, number>()
  private loginState: LoginState = { status: 'idle' }
  private install = installState(claudeFound() ? 'found' : 'missing')
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

  private nextCheck(id: string): number {
    const seq = (this.checks.get(id) ?? 0) + 1
    this.checks.set(id, seq)
    return seq
  }

  // Grava o resultado de uma conferência de login, se ela ainda é a mais recente da conta: uma
  // resposta velha chegando por último ("logada", depois de sair) é descartada. Falha passageira
  // (tempo esgotado) mantém o que se sabia, sem derrubar o monitor de uso; sem o `claude`
  // instalado, a conta fica sem status.
  private settle(id: string, seq: number, read: AccountRead): void {
    if (this.checks.get(id) !== seq) return
    if (read.ok) this.statuses.set(id, read.account)
    else if (!claudeFound()) this.statuses.set(id, null)
  }

  // Confere de novo o login de uma conta ou, sem ela, de todas.
  async refresh(id?: string): Promise<void> {
    // No Mac, um `claude` fora dos lugares conhecidos só aparece pelo shell de login.
    await lookupClaude()
    // Instalado por fora (no terminal) enquanto o app estava aberto, ou desinstalado.
    if (this.install.status !== 'installing') {
      const { status, message } = this.install
      if (claudeFound()) this.install = installState('found')
      else this.install = installState(status === 'found' ? 'missing' : status, message)
    }
    const ids = id ? [id] : accountIds()
    await Promise.all(
      ids.map(async (a) => {
        const seq = this.nextCheck(a)
        this.settle(a, seq, await readAccount(a))
      })
    )
    this.emit()
  }

  // Claude Code não achado: roda o instalador oficial e confere as contas de novo. Com um login já
  // guardado na máquina, o app entra direto.
  async installClaude(): Promise<void> {
    if (this.install.status === 'installing') return
    this.install = installState('installing')
    this.emit()
    const error = await runClaudeInstaller()
    this.install = claudeFound()
      ? installState('found')
      : installState('failed', error ?? 'O instalador terminou, mas o Claude Code não apareceu na pasta esperada.')
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
    const { q, inbox } = openLoginQuery(accountId)
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
      const seq = this.nextCheck(accountId)
      const read = await readAccount(accountId)
      if (!current()) return
      const status = read.ok ? read.account : (this.statuses.get(accountId) ?? null)
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
      this.settle(accountId, seq, read)
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
    // Uma conferência ainda em andamento não traz a conta de volta.
    this.checks.delete(id)
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
