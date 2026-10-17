import type { Account } from '../../shared/auth'
import type { ClaudeInfo } from '../../shared/models'
import type { Usage } from '../../shared/usage'
import { configEmail } from '../auth/status'
import { CodexUsageMonitors } from './codex'
import { UsageMonitor } from './monitor'
import { SavedUsages } from './saved'

export { UsageMonitor } from './monitor'

// Um monitor por conta logada. Quem sai ou é removida para, e o uso dela some da tela.
// As contas do Codex vão pelo mesmo aviso ('usage:update'), com a chave "codex:<id>" (ver codex.ts).
// Enquanto a conta não tem leitura nova nesta abertura, vale o último uso guardado dela, se o
// login for o mesmo que o gerou (ver saved.ts).
export class UsageMonitors {
  private monitors = new Map<string, UsageMonitor>()
  // E-mail do login conferido de cada conta, guardado junto com o uso lido.
  private emails = new Map<string, string | undefined>()
  // App fechando: um aviso de login que chegue depois não abre processo novo.
  private closed = false
  private saved = new SavedUsages()
  readonly codex: CodexUsageMonitors

  constructor(
    private onUpdate: (account: string, usage: Usage | null) => void,
    private onInfo: (account: string, info: ClaudeInfo) => void
  ) {
    this.codex = new CodexUsageMonitors(onUpdate, this.saved)
    // O guardado do Claude aparece já na abertura se o .claude.json da conta tem o mesmo login, sem
    // esperar o `claude auth status` (que pode demorar ou falhar). Os do Codex esperam a conferência.
    for (const key of this.saved.keys()) if (!key.includes(':')) this.saved.trust(key, configEmail(key))
  }

  // Cada conferência de login das contas do Claude. Sem status (não deu para conferir), a conta fica
  // como estava: nem abre monitor, nem perde o guardado.
  sync(accounts: { id: string; status: Account | null }[]): void {
    if (this.closed) return
    const ids = new Set(accounts.map((a) => a.id))
    for (const key of this.saved.keys()) if (!key.includes(':') && !ids.has(key)) this.forgetSaved(key)
    for (const { id, status } of accounts) {
      if (!status) continue
      const email = status.loggedIn ? status.email : undefined
      // Login trocado por fora (no terminal, com o app aberto): o `claude` do monitor ainda responde
      // pela conta anterior, e o uso dela seria guardado com o e-mail novo.
      const changed = this.emails.has(id) && this.emails.get(id) !== email
      this.emails.set(id, email)
      const monitor = this.monitors.get(id)
      // Sem login, o monitor é fechado logo abaixo (drop).
      if (changed && monitor && status.loggedIn) {
        monitor.reconnect()
        this.onUpdate(id, null)
      }
      const change = this.saved.confirm(id, { signedIn: status.loggedIn, email: status.email })
      if (change && !this.monitors.get(id)?.last) this.onUpdate(id, change === 'shown' ? this.saved.get(id) : null)
    }

    const loggedIn = accounts.filter((a) => a.status?.loggedIn).map((a) => a.id)
    for (const [account, monitor] of this.monitors) if (!loggedIn.includes(account)) this.drop(account, monitor)
    for (const account of loggedIn) {
      if (this.monitors.has(account)) continue
      const monitor = new UsageMonitor(
        account,
        (usage) => {
          this.saved.remember(account, usage, this.emails.get(account))
          this.onUpdate(account, usage)
        },
        (info) => this.onInfo(account, info)
      )
      this.monitors.set(account, monitor)
      monitor.start()
    }
  }

  // Login trocado: o `claude` aberto guardou o antigo e responderia pela conta anterior. O uso que
  // estava na tela era do login anterior: some até a leitura do novo.
  reconnect(account: string): void {
    this.emails.delete(account)
    this.saved.forget(account)
    this.monitors.get(account)?.reconnect()
    this.onUpdate(account, null)
  }

  // Uma janela do Argus ganhou foco: cada conta do Claude atualiza, se a última leitura passou de
  // 1 minuto. As do Codex seguem a cada 5 minutos, com ou sem foco (cada leitura abre um processo).
  refresh(): void {
    this.monitors.forEach((m) => m.refresh())
  }

  // O `claude` do app trocou (ver claudeVersion): todos abrem de novo com ele.
  reconnectAll(): void {
    this.monitors.forEach((m) => m.reconnect())
  }

  remove(account: string): void {
    const monitor = this.monitors.get(account)
    if (monitor) this.drop(account, monitor)
    else this.forgetSaved(account)
  }

  private drop(account: string, monitor: UsageMonitor): void {
    monitor.stop()
    this.monitors.delete(account)
    this.saved.forget(account)
    this.onUpdate(account, null)
  }

  private forgetSaved(key: string): void {
    if (this.saved.forget(key)) this.onUpdate(key, null)
  }

  all(): Record<string, Usage> {
    const out: Record<string, Usage> = {}
    for (const key of this.saved.keys()) {
      const saved = this.saved.get(key)
      if (saved) out[key] = saved
    }
    for (const [account, monitor] of this.monitors) if (monitor.last) out[account] = monitor.last
    return { ...out, ...this.codex.all() }
  }

  info(account: string): ClaudeInfo | null {
    return this.monitors.get(account)?.info ?? null
  }

  stop(): void {
    this.closed = true
    this.monitors.forEach((m) => m.stop())
    this.monitors.clear()
    this.codex.stop()
  }
}
