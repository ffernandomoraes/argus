import type { ClaudeInfo } from '../../shared/models'
import type { Usage } from '../../shared/usage'
import { UsageMonitor } from './monitor'

export { UsageMonitor } from './monitor'

// Um monitor por conta logada. Quem sai ou é removida para, e o uso dela some da tela.
export class UsageMonitors {
  private monitors = new Map<string, UsageMonitor>()
  // App fechando: um aviso de login que chegue depois não abre processo novo.
  private closed = false

  constructor(
    private onUpdate: (account: string, usage: Usage | null) => void,
    private onInfo: (account: string, info: ClaudeInfo) => void
  ) {}

  sync(loggedIn: string[]): void {
    if (this.closed) return
    for (const [account, monitor] of this.monitors) if (!loggedIn.includes(account)) this.drop(account, monitor)
    for (const account of loggedIn) {
      if (this.monitors.has(account)) continue
      const monitor = new UsageMonitor(
        account,
        (usage) => this.onUpdate(account, usage),
        (info) => this.onInfo(account, info)
      )
      this.monitors.set(account, monitor)
      monitor.start()
    }
  }

  // Login trocado: o `claude` aberto guardou o antigo e responderia pela conta anterior.
  reconnect(account: string): void {
    this.monitors.get(account)?.reconnect()
  }

  remove(account: string): void {
    const monitor = this.monitors.get(account)
    if (monitor) this.drop(account, monitor)
  }

  private drop(account: string, monitor: UsageMonitor): void {
    monitor.stop()
    this.monitors.delete(account)
    this.onUpdate(account, null)
  }

  all(): Record<string, Usage> {
    const out: Record<string, Usage> = {}
    for (const [account, monitor] of this.monitors) if (monitor.last) out[account] = monitor.last
    return out
  }

  info(account: string): ClaudeInfo | null {
    return this.monitors.get(account)?.info ?? null
  }

  stop(): void {
    this.closed = true
    this.monitors.forEach((m) => m.stop())
    this.monitors.clear()
  }
}
