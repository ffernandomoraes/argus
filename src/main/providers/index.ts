import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { clipboard, shell } from 'electron'
import {
  KEY_PAGES,
  MAIN_PROVIDER_ACCOUNT,
  PROVIDER_NAMES,
  PROVIDERS,
  type AccountKind,
  type ClipboardKey,
  type ProviderAccountStatus,
  type ProviderId,
  type ProviderInstall,
  type ProviderLogin,
  type ProvidersState
} from '../../shared/providers'
import { tr } from '../i18n'
import { errorMessage } from '../lib/errors'
import { findCommand, lookupShellPath } from './bins'
import { providerLaunch } from './env'
import { INSTALL_COMMANDS, runInstaller } from './install'
import { KEY_PATTERNS, keyHint, saveKey } from './keys'
import { ID, providerAccountDir } from './paths'
import {
  addEntry,
  addPending,
  customName,
  defaultEntry,
  dropPending,
  entries,
  findEntry,
  forgetEntry,
  renameEntry,
  setDefaultEntry
} from './registry'
import type { JsonRpcProcess } from './rpc'
import { checkKey, codexStatus, openCodex, readStatus } from './status'

export { providerLaunch } from './env'

// Contas dos agentes além do Claude: Codex, Gemini e Cursor. O login é sempre o do próprio CLI
// oficial (o app nunca lê nem copia token: reaproveitar token de assinatura dá banimento):
// - Codex: pelo navegador, pelo app-server (o mesmo caminho da extensão do VS Code). Várias contas.
// - Cursor: a principal pelo navegador (`agent login`, a do terminal); as outras por chave de API,
//   porque o login do Cursor mora num item fixo das Chaves do macOS e uma conta trocaria a outra.
// - Gemini: só chave de API. O Google suspende contas que usam o login Google do Gemini CLI em
//   apps de terceiros e pede chave para esse uso.
// A chave: o Argus abre a página onde ela é criada; ao voltar, reconhece a chave copiada, testa e
// guarda no cofre do sistema (keys.ts).

type LoginTarget = { provider: ProviderId; accountId: string; adding: boolean }
type LoginSession = LoginTarget & { stop: () => void }

const newId = () => randomUUID().replace(/-/g, '').slice(0, 8)

export class Providers {
  private statuses = new Map<string, ProviderAccountStatus | null>()
  private checks = new Map<string, number>()
  private installs: Record<ProviderId, ProviderInstall>
  private loginState: ProviderLogin = { status: 'idle' }
  private session: LoginSession | null = null
  state: ProvidersState

  constructor(
    private onState: (state: ProvidersState) => void,
    // Entrou de novo numa conta: o que roda com o login antigo dela recomeça.
    private onAccountChanged: (provider: ProviderId, id: string) => void,
    // Conta removida: o que roda com ela fecha antes de a pasta sumir.
    private onAccountRemoved: (provider: ProviderId, id: string) => void
  ) {
    this.installs = Object.fromEntries(PROVIDERS.map((p) => [p, this.installState(p)])) as Record<ProviderId, ProviderInstall>
    this.state = this.build()
  }

  private installState(provider: ProviderId, status?: ProviderInstall['status'], message?: string): ProviderInstall {
    return { status: status ?? (findCommand(provider) ? 'found' : 'missing'), message, command: INSTALL_COMMANDS[provider] }
  }

  private build(): ProvidersState {
    const providers = Object.fromEntries(
      PROVIDERS.map((provider) => {
        const taken = new Set<string>()
        const accounts = entries(provider).map(({ id, kind }) => {
          const status = this.statuses.get(`${provider}/${id}`) ?? null
          const custom = customName(provider, id)
          const name = custom ?? suggestName(id, kind, status, taken)
          taken.add(name)
          return { id, provider, kind, name, customName: !!custom, status }
        })
        return [provider, { install: this.installs[provider], accounts, defaultId: defaultEntry(provider) }]
      })
    ) as ProvidersState['providers']
    return { providers, login: this.loginState }
  }

  private emit(): void {
    this.state = this.build()
    this.onState(this.state)
  }

  private setLogin(login: ProviderLogin): void {
    this.loginState = login
    this.emit()
  }

  private async check(provider: ProviderId, id: string, kind: AccountKind): Promise<ProviderAccountStatus | null> {
    const k = `${provider}/${id}`
    const seq = (this.checks.get(k) ?? 0) + 1
    this.checks.set(k, seq)
    const status = await readStatus(provider, id, kind)
    // Resposta velha chegando por último é descartada; falha passageira mantém o que se sabia.
    if (this.checks.get(k) === seq && (status || !findCommand(provider))) this.statuses.set(k, status)
    return status
  }

  // Confere de novo a instalação e as contas de um agente ou, sem ele, de todos.
  async refresh(provider?: ProviderId): Promise<void> {
    await lookupShellPath()
    const list = provider ? [provider] : PROVIDERS
    for (const p of list) if (this.installs[p].status !== 'installing') this.installs[p] = this.installState(p, findCommand(p) ? 'found' : this.installs[p].status === 'failed' ? 'failed' : 'missing', this.installs[p].message)
    await Promise.all(list.flatMap((p) => entries(p).map((e) => this.check(p, e.id, e.kind))))
    this.emit()
  }

  async install(provider: ProviderId): Promise<void> {
    if (this.installs[provider].status === 'installing') return
    this.installs[provider] = this.installState(provider, 'installing')
    this.emit()
    const error = await runInstaller(provider)
    await lookupShellPath()
    this.installs[provider] = findCommand(provider)
      ? this.installState(provider, 'found')
      : this.installState(
          provider,
          'failed',
          error ?? tr(`O instalador terminou, mas o ${PROVIDER_NAMES[provider]} não apareceu.`, `The installer finished, but ${PROVIDER_NAMES[provider]} didn’t show up.`)
        )
    await this.refresh(provider)
  }

  // Conta nova. Codex e Cursor começam pela do terminal, se ainda não está no app (já logada, entra
  // direto); depois, o Codex abre o login numa pasta nova e o Cursor pede chave. O Gemini, sempre chave.
  async add(provider: ProviderId): Promise<void> {
    this.cancel()
    if (!findCommand(provider)) return
    const hasMain = !!findEntry(provider, MAIN_PROVIDER_ACCOUNT)
    if (provider !== 'gemini' && !hasMain) {
      addPending({ id: MAIN_PROVIDER_ACCOUNT, provider, kind: 'login' })
      const status = await readStatus(provider, MAIN_PROVIDER_ACCOUNT, 'login')
      if (status?.signedIn) {
        this.statuses.set(`${provider}/${MAIN_PROVIDER_ACCOUNT}`, status)
        addEntry({ id: MAIN_PROVIDER_ACCOUNT, provider, kind: 'login' })
        this.emit()
        return
      }
      return this.startLogin({ provider, accountId: MAIN_PROVIDER_ACCOUNT, adding: true })
    }
    const id = newId()
    if (provider === 'codex') {
      addPending({ id, provider, kind: 'login' })
      return this.startLogin({ provider, accountId: id, adding: true })
    }
    addPending({ id, provider, kind: 'key' })
    this.askKey({ provider, accountId: id, adding: true })
  }

  // Entra de novo numa conta da lista (login vencido, ou chave trocada).
  login(provider: ProviderId, id: string): void {
    const entry = findEntry(provider, id)
    if (!entry) return
    this.cancel()
    const target = { provider, accountId: id, adding: false }
    if (entry.kind === 'key') this.askKey(target)
    else void this.startLogin(target)
  }

  private askKey(target: LoginTarget): void {
    const page = KEY_PAGES[target.provider as 'gemini' | 'cursor']
    this.session = { ...target, stop: () => {} }
    this.setLogin({ status: 'key', ...target })
    if (page) void shell.openExternal(page)
  }

  // Chave de API copiada, se for do agente esperando chave: só o final dela sai daqui.
  async clipboardKey(): Promise<ClipboardKey> {
    const s = this.session
    if (!s || (this.loginState.status !== 'key' && this.loginState.status !== 'error')) return null
    const text = (await clipboard.readText()).trim()
    const pattern = KEY_PATTERNS[s.provider as 'gemini' | 'cursor']
    return pattern?.test(text) ? { provider: s.provider, hint: keyHint(text) } : null
  }

  // Usa a chave da área de transferência (sem ela passar pela tela) ou a colada à mão.
  async submitKey(typed?: string): Promise<void> {
    const s = this.session
    if (!s || (this.loginState.status !== 'key' && this.loginState.status !== 'error')) return
    const key = (typed ?? (await clipboard.readText())).trim()
    const target = { provider: s.provider, accountId: s.accountId, adding: s.adding }
    if (!key) return
    this.setLogin({ status: 'checking', ...target })
    const problem = await checkKey(s.provider, key, s.accountId)
    if (this.session !== s) return
    if (problem) return this.setLogin({ status: 'error', message: problem, ...target })
    try {
      saveKey(s.provider, s.accountId, key)
    } catch (err) {
      return this.setLogin({ status: 'error', message: errorMessage(err), ...target })
    }
    await this.finish(s)
  }

  // Login concluído (ou chave guardada): confere a conta, evita a mesma duas vezes e põe na lista.
  private async finish(s: LoginSession): Promise<void> {
    const entry = findEntry(s.provider, s.accountId)
    const kind = entry?.kind ?? 'login'
    const status = await readStatus(s.provider, s.accountId, kind)
    if (this.session !== s) return
    const target = { provider: s.provider, accountId: s.accountId, adding: s.adding }
    if (s.adding && status?.email) {
      const twin = this.state.providers[s.provider].accounts.find((a) => a.status?.email === status.email)
      if (twin) {
        this.discard(s)
        this.session = null
        return this.setLogin({
          status: 'error',
          message: tr(`essa conta já está no app, como "${twin.name}".`, `this account is already in the app, as "${twin.name}".`),
          ...target
        })
      }
    }
    if (s.adding) addEntry({ id: s.accountId, provider: s.provider, kind })
    this.statuses.set(`${s.provider}/${s.accountId}`, status)
    this.session = null
    this.onAccountChanged(s.provider, s.accountId)
    this.setLogin({ status: 'idle' })
  }

  private async startLogin(target: LoginTarget): Promise<void> {
    if (target.provider === 'codex') return this.codexLogin(target)
    if (target.provider === 'cursor') return this.cursorLogin(target)
  }

  // Codex: o app-server da conta gera o link; o navegador volta para ele (porta 1455) e ele avisa.
  private async codexLogin(target: LoginTarget): Promise<void> {
    const launch = providerLaunch('codex', ['app-server'], target.accountId)
    if (!launch) return
    let rpc: JsonRpcProcess | null = null
    const session: LoginSession = { ...target, stop: () => rpc?.close() }
    this.session = session
    this.setLogin({ status: 'waiting', ...target })
    try {
      rpc = await openCodex(launch)
      if (this.session !== session) return rpc.close()
      const done = new Promise<{ success: boolean; error?: string }>((resolve) => {
        rpc!.onNotification = (method, params) => {
          if (method === 'account/login/completed') resolve(params as { success: boolean; error?: string })
        }
        rpc!.onExit = () => resolve({ success: false, error: rpc?.lastError() || undefined })
      })
      const start = await rpc.request<{ authUrl: string }>('account/login/start', { type: 'chatgpt' })
      if (this.session !== session) return
      this.setLogin({ status: 'waiting', url: start.authUrl, ...target })
      void shell.openExternal(start.authUrl)
      const result = await done
      if (this.session !== session) return
      if (!result.success) throw new Error(result.error || tr('O login não terminou.', 'Sign-in didn’t finish.'))
      const read = await rpc.request('account/read', { refreshToken: false })
      rpc.close()
      this.statuses.set(`codex/${target.accountId}`, codexStatus(read as never))
      await this.finish(session)
    } catch (err) {
      rpc?.close()
      if (this.session !== session) return
      this.fail(session, err)
    }
  }

  // Cursor (só a principal): o `agent login` do terminal. Sem abrir o navegador sozinho, ele mostra
  // o link; o app abre e espera ele sair.
  private cursorLogin(target: LoginTarget): void {
    const launch = providerLaunch('cursor', ['login'], target.accountId)
    if (!launch) return
    launch.env.NO_OPEN_BROWSER = '1'
    const child: ChildProcess = spawn(launch.file, launch.args, { env: launch.env, cwd: homedir(), windowsHide: true })
    const session: LoginSession = { ...target, stop: () => child.kill() }
    this.session = session
    this.setLogin({ status: 'waiting', ...target })
    let out = ''
    let opened = false
    const read = (d: Buffer) => {
      out = (out + d.toString('utf8')).slice(-8000)
      const url = /https:\/\/\S+/.exec(out.replace(/\x1b\[[0-9;]*m/g, ''))?.[0]
      if (url && !opened && this.session === session) {
        opened = true
        this.setLogin({ status: 'waiting', url, ...target })
        void shell.openExternal(url)
      }
    }
    child.stdout?.on('data', read)
    child.stderr?.on('data', read)
    child.on('error', (err) => this.session === session && this.fail(session, err))
    child.on('exit', (code) => {
      if (this.session !== session) return
      if (code === 0) void this.finish(session)
      else this.fail(session, new Error(tr('O login do Cursor não terminou.', 'Cursor sign-in didn’t finish.')))
    })
  }

  private fail(s: LoginSession, err: unknown): void {
    this.discard(s)
    this.session = null
    this.setLogin({ status: 'error', message: errorMessage(err) || tr('Não deu para entrar.', 'Couldn’t sign in.'), provider: s.provider, accountId: s.accountId, adding: s.adding })
  }

  // Conta nova que não chegou a entrar: some a pasta (a principal não tem pasta).
  private discard(s: LoginSession): void {
    s.stop()
    if (!s.adding) return
    dropPending(s.provider, s.accountId)
    removeDir(s.provider, s.accountId)
  }

  cancel(): void {
    const s = this.session
    this.session = null
    if (s) this.discard(s)
    if (this.loginState.status !== 'idle') this.setLogin({ status: 'idle' })
  }

  // Tira a conta do app. A do terminal só sai da lista (continua logada no terminal); as outras
  // perdem a pasta, com o login e a chave.
  remove(provider: ProviderId, id: string): void {
    if (!findEntry(provider, id)) return
    if (this.session?.provider === provider && this.session.accountId === id) this.cancel()
    this.onAccountRemoved(provider, id)
    forgetEntry(provider, id)
    removeDir(provider, id)
    this.statuses.delete(`${provider}/${id}`)
    this.checks.delete(`${provider}/${id}`)
    this.emit()
  }

  rename(provider: ProviderId, id: string, name: string): void {
    if (!findEntry(provider, id)) return
    renameEntry(provider, id, name)
    this.emit()
  }

  setDefault(provider: ProviderId, id: string): void {
    setDefaultEntry(provider, id)
    this.emit()
  }
}

function removeDir(provider: ProviderId, id: string): void {
  const dir = providerAccountDir(provider, id)
  if (!dir || !ID.test(id)) return
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })
  } catch (err) {
    console.warn('[providers] não deu para apagar a pasta da conta:', dir, errorMessage(err))
  }
}

// Nome sugerido: o e-mail da conta; chave sem e-mail, o final dela.
function suggestName(id: string, kind: AccountKind, status: ProviderAccountStatus | null, taken: Set<string>): string {
  const email = status?.email
  if (email) return taken.has(email) ? `${email} (${id})` : email
  if (kind === 'key' && status?.keyHint) return tr(`Chave ${status.keyHint}`, `Key ${status.keyHint}`)
  return id === MAIN_PROVIDER_ACCOUNT ? tr('Do terminal', 'From terminal') : tr('Conta', 'Account')
}
