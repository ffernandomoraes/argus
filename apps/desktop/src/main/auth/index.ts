import { shell } from 'electron'
import {
  loginEndingSoon,
  loginIdentity,
  MAIN_ACCOUNT,
  sameIdentity,
  sameLogin,
  type Account,
  type AuthState,
  type ClaudeInstall,
  type LoginMethod,
  type LoginState,
  type MergeNotice,
  type WslLogin
} from '@argus/shared/auth'
import {
  accountDir,
  accountIds,
  addAccount,
  clearLoginLost,
  createPendingAccount,
  customName,
  defaultAccount,
  discardAccount,
  forgetLoginMethod,
  lastIdentity,
  loginMethod,
  markLoginLost,
  mergeAccount,
  mergedAccounts,
  rememberIdentity,
  rememberLoginMethod,
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
import { readStoredState } from '../claudeAuth/store'
import { createBackoff } from '../lib/backoff'
import { withTimeout } from '../lib/timeout'
import { distroFor } from '../wsl'
import { openLoginQuery, type LoginQuery } from './loginQuery'
import { readAccount, runClaude, type AccountRead } from './status'
import { findTwins } from './twins'
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

// De quanto em quanto tempo as contas perto do prazo final do login são conferidas (ver recheckEnding).
const ENDING_CHECK_MS = 30 * 60_000
// Quantas vezes seguidas uma conta com o login por renovar é conferida de novo (ver settle).
const RENEW_CHECKS = 3
// Intervalo mínimo entre conferências de uma conta pedidas por conversas recusadas (ver loginLost).
const LOST_CHECK_GAP_MS = 20_000

// Prazo da leitura do login guardado para o aviso de login perdido (ver reportLostLogin).
const STORED_TIMEOUT_MS = 10_000

// O que levou a conferir a conta, para o aviso de login perdido. open: a primeira conferência da
// abertura. chat: uma conversa recusada por falta de login. usage: o monitor de uso achou o login
// apagado. external: o login guardado mudou por fora (no terminal). login: logo depois de entrar.
export type CheckTrigger = 'open' | 'refresh' | 'retry' | 'deadline' | 'chat' | 'usage' | 'external' | 'login' | 'twin'

// Chave do login de uma conta dentro de uma distro do WSL (ver wslPlace.ts).
const wslKey = (distro: string, id: string) => `${distro.toLowerCase()}\0${id}`

// Como a conta entrou, pelo que o `auth status` responde (authMethod). Chave de API do ambiente,
// Bedrock e afins não são um login que o app refaz: nada.
const methodOf = (account: Account): LoginMethod | undefined =>
  account.method === 'claude.ai' ? 'claudeai' : account.method === 'console' ? 'console' : undefined

export class Auth {
  private statuses = new Map<string, Account | null>()
  // Login de cada conta nas distros do WSL que não são a do `claude` do app (ver wslKey).
  private wslStatuses = new Map<string, Account>()
  // Número da conferência mais recente de cada conta (ver settle).
  private checks = new Map<string, number>()
  private loginState: LoginState = { status: 'idle' }
  private install = installState(claudeFound() ? 'found' : 'missing')
  private session: LoginSession | null = null
  // Contas cuja última conferência falhou (tempo esgotado, `claude` que não abriu) ou pegou o login
  // no meio da renovação (ver storedHint), refeita sozinha em 30 s, 1 min, 2 min... até 10 min. Sem
  // isso, uma falha na abertura deixava a conta sem status, e sem monitor de uso, até a pessoa abrir
  // as Configurações ou reabrir o app.
  private unsure = new Set<string>()
  // Conferências seguidas de cada conta que acharam o login ainda por renovar (ver settle).
  private renewTries = new Map<string, number>()
  // Quando cada conta foi conferida por causa de uma conversa recusada (ver loginLost).
  private lostAt = new Map<string, number>()
  private retry: NodeJS.Timeout | null = null
  private retryBackoff = createBackoff({ initialMs: 30_000, maxMs: 10 * 60_000 })
  // Contas com o login perto do prazo final (ver loginEndingSoon) são conferidas de novo de tempos em
  // tempos: passado o prazo, o Claude Code apaga o login, e a conta passa a aparecer sem login sem
  // esperar a próxima abertura do app ou das Configurações. Sem conta perto do prazo, não roda nada.
  private ending: NodeJS.Timeout
  private closed = false
  // Contas juntadas desde o último aviso fechado (ver mergeTwins).
  private mergeNotice: MergeNotice | null = null
  // Contas de que a pessoa está saindo pelo app agora: ficar sem login não é login perdido.
  private leaving = new Set<string>()
  // Quando cada conta foi vista logada pela última vez nesta abertura, para o aviso de login perdido.
  private seenLoggedIn = new Map<string, number>()
  private openedAt = Date.now()
  state: AuthState

  constructor(
    private onState: (state: AuthState) => void,
    // Entrou ou saiu de uma conta: o que roda com o login antigo dela precisa recomeçar.
    // distro: trocou só o login dela dentro daquela distro do WSL.
    private onAccountChanged: (id: string, distro?: string) => void,
    // Conta removida: o que roda com ela é encerrado antes de a pasta sumir.
    private onAccountRemoved: (id: string) => void,
    // Conta que saiu da lista por ter o mesmo login de `into` (ver mergeTwins). A pasta dela só some
    // na próxima abertura: o que está trabalhando com ela termina em paz.
    private onAccountMerged: (removed: string, into: string) => void = () => {},
    // Uma conta perdeu o login sem ninguém sair dela pelo app: vai ao Sentry o que se sabe (ver
    // reportLostLogin). Sem e-mail nem nome.
    private reportLost: (extra: Record<string, unknown>) => void = () => {}
  ) {
    this.state = this.build()
    this.ending = setInterval(() => this.recheckEnding(), ENDING_CHECK_MS)
    this.ending.unref()
  }

  private recheckEnding(): void {
    if (this.closed) return
    const now = Date.now()
    const soon = (status: Account | null | undefined) => loginEndingSoon(status, now)
    const inWsl = (id: string) => [...this.wslStatuses].some(([key, status]) => key.endsWith(`\0${id}`) && soon(status))
    const ids = accountIds().filter((id) => soon(this.statuses.get(id)) || inWsl(id))
    if (ids.length) void this.check(ids, 'deadline')
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
      const method = loginMethod(id)
      return { id, name, customName: !!custom, dir: accountDir(id), status, ...(wsl.length > 0 && { wsl }), ...(method && { loginMethod: method }) }
    })
    const mergedInto = mergedAccounts()
    return {
      claude: this.install,
      accounts,
      defaultId: defaultAccount(),
      login: this.loginState,
      ...(Object.keys(mergedInto).length > 0 && { mergedInto: { ...mergedInto } }),
      ...(this.mergeNotice && { mergeNotice: this.mergeNotice })
    }
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
  // instalado, a conta fica sem status. Resposta com o login ainda por renovar (renewing) vale por
  // agora, e a conta é conferida de novo como as que falharam: a renovação pode apagar o login.
  private settle(id: string, seq: number, read: AccountRead, trigger: CheckTrigger): void {
    if (this.checks.get(id) !== seq) return
    if (read.ok) this.noteLogin(id, read.account, trigger)
    if (read.ok) this.statuses.set(id, read.account)
    else if (!claudeFound()) this.statuses.set(id, null)
    // Logada: guarda como ela entrou, para entrar de novo do mesmo jeito se o login se perder.
    const method = read.ok && read.account.loggedIn ? methodOf(read.account) : undefined
    if (method) rememberLoginMethod(id, method)
    // E de quem é o login: a conta segue reconhecida depois de ele cair (ver lostTwin).
    const identity = read.ok ? loginIdentity(read.account) : undefined
    if (identity) rememberIdentity(id, identity)
    // Por renovar: confere de novo poucas vezes. Um login que segue vencido sem ninguém renovar (sem
    // rede, ou o login de verdade guardado em outro lugar, como o cofre de credenciais do Windows)
    // não pode virar uma conferência a cada 10 minutos para sempre.
    const tries = read.ok && read.renewing ? (this.renewTries.get(id) ?? 0) + 1 : 0
    if (read.ok) this.renewTries.set(id, tries)
    const renewing = tries > 0 && tries <= RENEW_CHECKS
    if ((read.ok && !renewing) || !claudeFound()) this.unsure.delete(id)
    else this.unsure.add(id)
  }

  // Antes de gravar o status novo: a conta que estava logada (ou que deveria estar, na primeira
  // conferência da abertura; ver lostLogin) e aparece sem login perdeu o login. Vai ao Sentry uma vez
  // por perda (ver markLoginLost): em 2026-11-13 uma conta caiu dois dias seguidos num Mac e não
  // havia rastro nenhum do motivo. Sair pelo app não conta; sair pelo terminal conta, e o estado do
  // login guardado diz a diferença (apagado pelo Claude Code fica "ended"; saída, "missing").
  private noteLogin(id: string, account: Account, trigger: CheckTrigger): void {
    const now = Date.now()
    if (account.loggedIn) {
      this.seenLoggedIn.set(id, now)
      clearLoginLost(id)
      return
    }
    if (this.leaving.has(id)) return
    const first = !this.statuses.has(id)
    const before = this.statuses.get(id)
    const expected = before?.loggedIn || (first && (id !== MAIN_ACCOUNT || !!loginMethod(id)))
    if (!expected || !markLoginLost(id, now)) return
    void this.reportLostLogin(id, before ?? null, first && trigger !== 'login' ? 'open' : trigger, now)
  }

  private async reportLostLogin(id: string, before: Account | null, trigger: CheckTrigger, now: number): Promise<void> {
    const read = await withTimeout(readStoredState(id), STORED_TIMEOUT_MS, null)
    const seen = this.seenLoggedIn.get(id)
    this.reportLost({
      trigger,
      main: id === MAIN_ACCOUNT,
      accounts: accountIds().length,
      seenLoggedInThisOpening: !!before?.loggedIn,
      minutesSinceSeenLoggedIn: seen ? Math.round((now - seen) / 60_000) : null,
      minutesSinceOpening: Math.round((now - this.openedAt) / 60_000),
      loginMethod: loginMethod(id) ?? null,
      authMethod: before?.method ?? null,
      subscriptionType: before?.subscriptionType ?? null,
      // Negativo: o prazo final do login já tinha passado (ver Account.loginEndsAt).
      hoursToLoginEnd: before?.loginEndsAt ? Math.round((before.loginEndsAt - now) / 3_600_000) : null,
      storedState: read?.state ?? 'timeout',
      loginEnded: read?.stored?.claudeAiOauth?.loginEnded ?? null,
      // Outra conta do app estava com o mesmo login do Claude (antes de serem juntadas).
      sameLoginInOtherAccount: before ? accountIds().some((a) => a !== id && sameLogin(before, this.statuses.get(a))) : null
    })
  }

  // Uma conversa da conta foi recusada por falta de login (ver ChatHooks.loginLost): o login se
  // perdeu com o app aberto (apagado pelo Claude Code, recusado pelo servidor, vencido). A conta é
  // conferida já, para o cartão, a barra de uso e os menus mostrarem o mesmo que a conversa. Várias
  // conversas da mesma conta costumam falhar juntas: uma conferência por conta a cada 20 s.
  // source: quem achou (uma conversa, ou o monitor de uso), para o aviso de login perdido.
  loginLost(id: string, source: 'chat' | 'usage'): void {
    if (this.closed || !accountIds().includes(id)) return
    const now = Date.now()
    if (now - (this.lostAt.get(id) ?? 0) < LOST_CHECK_GAP_MS) return
    this.lostAt.set(id, now)
    void this.check([id], source)
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
      void this.check([...this.unsure], 'retry')
    }, this.retryBackoff.next())
  }

  // Confere de novo o login de uma conta ou, sem ela, de todas.
  refresh(id?: string, trigger: CheckTrigger = 'refresh'): Promise<void> {
    return this.check(id ? [id] : accountIds(), trigger)
  }

  private async check(ids: string[], trigger: CheckTrigger): Promise<void> {
    // No Mac, um `claude` fora dos lugares conhecidos só aparece pelo shell de login.
    await lookupClaude()
    // Instalado por fora (no terminal) enquanto o app estava aberto, ou desinstalado.
    if (this.install.status !== 'installing') {
      const { status, message } = this.install
      if (claudeFound()) this.install = installState('found')
      else this.install = installState(status === 'found' ? 'missing' : status, message)
    }
    const fresh: string[] = []
    await Promise.all(
      ids.map(async (a) => {
        const seq = this.nextCheck(a)
        const read = await readAccount(a)
        if (read.ok) fresh.push(a)
        this.settle(a, seq, read, trigger)
      })
    )
    this.mergeTwins(await this.confirmTwins(fresh))
    this.emit()
    this.retryLater()
    // Sem segurar quem espera a conferência (a abertura do app): o WSL pode demorar a responder.
    void this.checkWsl(ids)
  }

  // Antes de juntar duas contas com o mesmo login, o status de cada uma tem que ser de agora: o
  // guardado de uma conferência antiga pode ser de um login que já trocou por fora. fresh: as que
  // acabaram de ser conferidas. Devolve as que não deu para conferir: essas não são juntadas agora.
  private async confirmTwins(fresh: string[]): Promise<Set<string>> {
    const unsure = new Set<string>()
    const listed = accountIds().map((id) => ({ id, status: this.statuses.get(id) }))
    const stale = [...new Set(findTwins(listed).flatMap((t) => [t.keep, t.remove]))].filter((id) => !fresh.includes(id))
    await Promise.all(
      stale.map(async (id) => {
        const seq = this.nextCheck(id)
        const read = await readAccount(id)
        if (!read.ok) unsure.add(id)
        this.settle(id, seq, read, 'twin')
      })
    )
    return unsure
  }

  // Duas contas do app com o mesmo login do Claude viram uma (ver twins.ts): a que sai deixa a lista
  // já, e os grupos e as conversas dela passam a usar a que ficou (ver mergeAccount). unsure: contas
  // cujo status não é de agora (ver confirmTwins). justLoggedIn: a conta em que a pessoa acabou de
  // entrar. Devolve as que saíram.
  private mergeTwins(unsure: Set<string>, justLoggedIn?: string): Set<string> {
    const removed = new Set<string>()
    if (this.closed) return removed
    const listed = accountIds().map((id) => ({ id, status: this.statuses.get(id) }))
    const twins = findTwins(listed, justLoggedIn)
    if (!twins.length) return removed
    const names = new Map(this.build().accounts.map((a) => [a.id, a.name]))
    for (const { keep, remove } of twins) {
      // Login em andamento na que sairia: ela pode terminar com outro login. A próxima conferência vê.
      if (this.session?.accountId === remove || unsure.has(keep) || unsure.has(remove)) continue
      this.onAccountMerged(remove, keep)
      mergeAccount(remove, keep)
      this.forgetStatus(remove)
      removed.add(remove)
      const kept = names.get(keep) ?? ''
      const gone = names.get(remove) ?? ''
      this.mergeNotice = this.mergeNotice?.kept === kept ? { kept, removed: [...this.mergeNotice.removed, gone] } : { kept, removed: [gone] }
    }
    return removed
  }

  // A pessoa fechou o aviso de contas juntadas.
  dismissMergeNotice(): void {
    if (!this.mergeNotice) return
    this.mergeNotice = null
    this.emit()
  }

  // Conta que saiu da lista: nada do que se sabia dela fica, e uma conferência ainda em andamento
  // não a traz de volta.
  private forgetStatus(id: string): void {
    this.statuses.delete(id)
    this.unsure.delete(id)
    this.renewTries.delete(id)
    this.lostAt.delete(id)
    this.seenLoggedIn.delete(id)
    this.checks.delete(id)
    for (const key of [...this.wslStatuses.keys()]) if (key.endsWith(`\0${id}`)) this.wslStatuses.delete(key)
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
          // Sem e-mail (chave de API), não dá para dizer que é a mesma (ver sameLogin).
          this.state.accounts.find((a) => sameLogin(a.status, status))
        if (twin) {
          // A mesma conta duas vezes: a nova some com o login dela.
          this.stop()
          this.setLogin({ status: 'error', message: tr(`essa conta já está no app, como "${twin.name}".`, `this account is already in the app, as "${twin.name}".`), ...target })
          return
        }
        // A mesma conta que está na lista sem login (ou sem resposta agora): o login que caiu era
        // dela, pelo identificador guardado. Adicionar criaria a segunda; o caminho é entrar de novo
        // na que já existe. Caso de 2026-11-13: o login venceu, a pessoa entrou por "Adicionar conta"
        // e a mesma conta apareceu duas vezes.
        const lostTwin = status?.loggedIn && this.state.accounts.find((a) => !a.status?.loggedIn && sameIdentity(lastIdentity(a.id), loginIdentity(status)))
        if (lostTwin) {
          this.stop()
          // Sem resposta agora (status nulo), não dá para dizer que ela está sem login.
          const message =
            lostTwin.status?.loggedIn === false
              ? tr(
                  `essa conta já está no app, como "${lostTwin.name}", que está sem login. Cancele e use o "Entrar" dela.`,
                  `this account is already in the app, as "${lostTwin.name}", which is signed out. Cancel and use its "Sign in".`
                )
              : tr(`essa conta já está no app, como "${lostTwin.name}".`, `this account is already in the app, as "${lostTwin.name}".`)
          this.setLogin({ status: 'error', message, ...target })
          return
        }
        addAccount(accountId)
      }
      // O jeito que acabou de dar certo, mesmo que a conferência não diga (ver methodOf).
      if (status?.loggedIn) rememberLoginMethod(accountId, method)
      this.settle(accountId, seq, read, 'login')
      // Entrou com o login de outra conta do app (o claude.ai aberto no navegador era o dela, ou a
      // outra estava sem login quando esta foi adicionada): fica uma só.
      const unsure = await this.confirmTwins(read.ok ? [accountId] : [])
      if (!current()) return
      this.stop(false)
      const merged = this.mergeTwins(unsure, accountId)
      // A que saiu não tem o que recomeçar: o que era dela passa a abrir com a que ficou.
      if (!merged.has(accountId)) this.onAccountChanged(accountId)
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
    clearInterval(this.ending)
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
    // Saída pedida: a conferência logo abaixo não avisa login perdido (ver noteLogin).
    this.leaving.add(MAIN_ACCOUNT)
    try {
      await runClaude(['auth', 'logout'], MAIN_ACCOUNT)
    } catch (err) {
      console.warn('[auth] claude auth logout falhou:', (err as Error).message)
      ok = false
    }
    // Saiu de propósito: a principal não aparece como login perdido (ver lostLogin).
    if (ok) forgetLoginMethod(MAIN_ACCOUNT)
    await this.refresh(MAIN_ACCOUNT).finally(() => this.leaving.delete(MAIN_ACCOUNT))
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
    this.forgetStatus(id)
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
