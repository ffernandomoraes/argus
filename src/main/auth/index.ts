import { shell } from 'electron'
import { MAIN_ACCOUNT, type Account, type AuthState, type ClaudeInstall, type LoginMethod, type LoginState, type WslLogin } from '../../shared/auth'
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
import { claudeFound, lookupClaude } from '../claudePath'
import { tr } from '../i18n'
import { gitFound } from '../platform'
import { createBackoff } from '../lib/backoff'
import { distroFor } from '../wsl'
import { openLoginQuery, type LoginQuery } from './loginQuery'
import { readAccount, runClaude, type AccountRead } from './status'
import { loginDistro, otherDistros, readWslAccount, wslPlace } from './wslPlace'

// Mesmo caminho da extensão do VS Code: um `claude` aberto só para o login gera o link,
// recebe o retorno do navegador e grava o login, nas Chaves do macOS (no Windows, num arquivo da
// pasta de configuração). Na principal, onde o Claude Code inteiro (terminal, VS Code, este app)
// passa a usar; nas outras, no item da pasta da conta (ver accounts/).

// O Git é conferido junto: no Windows, a etapa de configuração mostra se falta. Com o Claude Code
// rodando no WSL, vale o git de lá.
function installState(status: ClaudeInstall['status'], message?: string): ClaudeInstall {
  return { status, message, command: INSTALL_COMMAND, git: gitFound() || !!distroFor() }
}

// adding: conta nova, cuja pasta some se o login não terminar.
type LoginSession = { q: LoginQuery; inbox: Inbox; accountId: string; adding: boolean }

// Chave do login de uma conta dentro de uma distro do WSL (ver wslPlace.ts).
const wslKey = (distro: string, id: string) => `${distro.toLowerCase()}\0${id}`

export class Auth {
  private statuses = new Map<string, Account | null>()
  // Login de cada conta nas distros do WSL que não são a do `claude` do app (ver wslKey).
  private wslStatuses = new Map<string, Account>()
  // Número da conferência mais recente de cada conta (ver settle).
  private checks = new Map<string, number>()
  private loginState: LoginState = { status: 'idle' }
  private install = installState(claudeFound() ? 'found' : 'missing')
  private session: LoginSession | null = null
  // Contas cuja última conferência falhou (tempo esgotado, `claude` que não abriu), refeita sozinha
  // em 30 s, 1 min, 2 min... até 10 min. Sem isso, uma falha na abertura deixava a conta sem status,
  // e sem monitor de uso, até a pessoa abrir as Configurações ou reabrir o app.
  private unsure = new Set<string>()
  private retry: NodeJS.Timeout | null = null
  private retryBackoff = createBackoff({ initialMs: 30_000, maxMs: 10 * 60_000 })
  private closed = false
  state: AuthState

  constructor(
    private onState: (state: AuthState) => void,
    // Entrou ou saiu de uma conta: o que roda com o login antigo dela precisa recomeçar.
    // distro: trocou só o login dela dentro daquela distro do WSL.
    private onAccountChanged: (id: string, distro?: string) => void,
    // Conta removida: o que roda com ela é encerrado antes de a pasta sumir.
    private onAccountRemoved: (id: string) => void
  ) {
    this.state = this.build()
  }

  private build(): AuthState {
    const taken = new Set<string>()
    const distros = otherDistros()
    const accounts = accountIds().map((id) => {
      const status = this.statuses.get(id) ?? null
      const custom = customName(id)
      const name = custom ?? suggestedName(id, status, taken)
      taken.add(name)
      const wsl: WslLogin[] = distros.map((distro) => ({ distro, status: this.wslStatuses.get(wslKey(distro, id)) ?? null }))
      return { id, name, customName: !!custom, dir: accountDir(id), status, ...(wsl.length > 0 && { wsl }) }
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
    if (read.ok || !claudeFound()) this.unsure.delete(id)
    else this.unsure.add(id)
  }

  // Refaz a conferência das contas que falharam, com espera crescente; tudo certo, a espera volta ao
  // início.
  private retryLater(): void {
    const ids = accountIds()
    for (const id of this.unsure) if (!ids.includes(id)) this.unsure.delete(id)
    if (!this.unsure.size || this.closed) {
      if (this.retry) clearTimeout(this.retry)
      this.retry = null
      if (!this.unsure.size) this.retryBackoff.reset()
      return
    }
    if (this.retry) return
    this.retry = setTimeout(() => {
      this.retry = null
      void this.check([...this.unsure])
    }, this.retryBackoff.next())
  }

  // Confere de novo o login de uma conta ou, sem ela, de todas.
  refresh(id?: string): Promise<void> {
    return this.check(id ? [id] : accountIds())
  }

  private async check(ids: string[]): Promise<void> {
    // No Mac, um `claude` fora dos lugares conhecidos só aparece pelo shell de login.
    await lookupClaude()
    // Instalado por fora (no terminal) enquanto o app estava aberto, ou desinstalado.
    if (this.install.status !== 'installing') {
      const { status, message } = this.install
      if (claudeFound()) this.install = installState('found')
      else this.install = installState(status === 'found' ? 'missing' : status, message)
    }
    await Promise.all(
      ids.map(async (a) => {
        const seq = this.nextCheck(a)
        this.settle(a, seq, await readAccount(a))
      })
    )
    this.emit()
    this.retryLater()
    // Sem segurar quem espera a conferência (a abertura do app): o WSL pode demorar a responder.
    void this.checkWsl(ids)
  }

  // O login das mesmas contas dentro de cada distro do WSL com o Claude Code. Falha (o WSL não
  // respondeu) mantém o que se sabia.
  private async checkWsl(ids: string[]): Promise<void> {
    const distros = otherDistros()
    if (!distros.length) return
    let changed = false
    await Promise.all(
      distros.flatMap((distro) =>
        ids.map(async (id) => {
          const key = wslKey(distro, id)
          const seq = this.nextCheck(key)
          const read = await readWslAccount(distro, id).catch((): AccountRead => ({ ok: false }))
          if (this.checks.get(key) !== seq || !read.ok || !accountIds().includes(id)) return
          this.wslStatuses.set(key, read.account)
          changed = true
        })
      )
    )
    if (changed && !this.closed) this.emit()
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
      : installState(
          'failed',
          error ??
            tr(
              'O instalador terminou, mas o Claude Code não apareceu na pasta esperada.',
              "The installer finished, but Claude Code didn't show up in the expected folder."
            )
        )
    await this.refresh()
  }

  // Entra de novo numa conta da lista, ou em outra no lugar dela. distro: o login da conta dentro
  // daquela distro do WSL (o das pastas de lá); a do próprio `claude` do app é o login comum.
  // openBrowser falso: o pedido veio de outro computador (acesso remoto), que entra pela página do
  // código; o navegador daqui abriria sem ninguém para ver.
  login(accountId: string, method: LoginMethod, distro?: string, { openBrowser = true } = {}): void {
    if (!accountIds().includes(accountId)) return
    void this.start(accountId, false, method, loginDistro(distro), openBrowser)
  }

  // Conta nova: ganha a pasta agora e só entra na lista quando o login termina.
  add(method: LoginMethod, { openBrowser = true } = {}): void {
    this.stop()
    void this.start(createPendingAccount(), true, method, undefined, openBrowser)
  }

  private async start(accountId: string, adding: boolean, method: LoginMethod, distro?: string, openBrowser = true): Promise<void> {
    this.stop()
    const { q, inbox } = openLoginQuery(accountId, distro && wslPlace(distro))
    const session: LoginSession = { q, inbox, accountId, adding }
    this.session = session
    const current = () => this.session === session
    const target = { accountId, adding, ...(distro && { distro }) }
    this.setLogin({ status: 'starting', method, ...target })

    try {
      const { manualUrl, automaticUrl } = await q.claudeAuthenticate(method === 'claudeai')
      if (!current()) return
      // Pede antes de abrir o navegador, para não perder um retorno rápido.
      const done = q.claudeOAuthWaitForCompletion()
      this.setLogin({ status: 'waiting', method, automaticUrl, manualUrl, ...target })
      if (openBrowser) void shell.openExternal(automaticUrl)
      await done
      if (!current()) return
      if (distro) {
        // O login do Windows não mudou: só o da distro é conferido, e só as conversas reabrem.
        const key = wslKey(distro, accountId)
        const seq = this.nextCheck(key)
        const read = await readWslAccount(distro, accountId).catch((): AccountRead => ({ ok: false }))
        if (!current()) return
        if (this.checks.get(key) === seq && read.ok) this.wslStatuses.set(key, read.account)
        this.stop(false)
        this.onAccountChanged(accountId, distro)
        this.setLogin({ status: 'idle' })
        return
      }
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
          this.setLogin({ status: 'error', message: tr(`essa conta já está no app, como "${twin.name}".`, `this account is already in the app, as "${twin.name}".`), ...target })
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
      this.setLogin({ status: 'error', message: (err as Error).message || tr('Não deu para entrar.', "Couldn't sign in."), ...target })
    }
  }

  // Código copiado da página do navegador, no formato "código#estado".
  submitCode(code: string): void {
    const s = this.session
    if (!s) return
    const [authorizationCode, state = ''] = code.trim().split('#')
    s.q.claudeOAuthCallback(authorizationCode, state).catch((err: Error) => {
      if (this.session === s) {
        const distro = this.loginState.status !== 'idle' ? this.loginState.distro : undefined
        this.setLogin({ status: 'error', message: err.message || tr('Código recusado.', 'Code rejected.'), accountId: s.accountId, adding: s.adding, ...(distro && { distro }) })
      }
    })
  }

  // App fechando: encerra o login em andamento e não confere mais nada.
  close(): void {
    this.closed = true
    this.retryLater()
    this.cancel()
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
    let ok = true
    try {
      await runClaude(['auth', 'logout'], MAIN_ACCOUNT)
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
    await runClaude(['auth', 'logout'], id).catch(() => {})
    removeAccount(id)
    this.statuses.delete(id)
    this.unsure.delete(id)
    // Uma conferência ainda em andamento não traz a conta de volta.
    this.checks.delete(id)
    for (const key of [...this.wslStatuses.keys()]) if (key.endsWith(`\0${id}`)) this.wslStatuses.delete(key)
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
