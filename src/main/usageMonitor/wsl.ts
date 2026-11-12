import type { ClaudeAccount } from '../../shared/auth'
import type { Usage } from '../../shared/usage'
import { wslUsage } from '../../shared/wslUsage'
import { homeUnc, runningDistros, sameDistro, toUnc } from '../wsl'
import type { LoginWatch } from './loginWatch'
import { UsageMonitor } from './monitor'

// Uso do login de uma conta dentro de uma distro do WSL, quando ele é de uma conta do Claude que o
// app não tem no Windows (ver shared/wslUsage.ts): um monitor por login, na chave "wsl:<distro>:<conta>".
// Só a leitura direta, com o login lido do arquivo de lá, e só com a distro ligada (ver MonitorOptions).
// Sem uso guardado entre aberturas: a linha aparece com a primeira leitura. Os limites que chegam nas
// conversas de lá não entram (ver sharesAppLogin): o número anda a cada leitura direta.
export class WslUsageMonitors {
  private monitors = new Map<string, { monitor: UsageMonitor; email: string; account: string; distro: string }>()
  private closed = false

  constructor(
    private onUpdate: (key: string, usage: Usage | null) => void,
    private logins: LoginWatch
  ) {}

  // Cada conferência de login das contas. Sem decidir ainda (sem e-mail), fica como estava.
  sync(accounts: Pick<ClaudeAccount, 'id' | 'status' | 'wsl'>[]): void {
    if (this.closed) return
    const wanted = new Map(wslUsage(accounts).logins.map((l) => [l.key, l]))
    for (const [key, entry] of this.monitors) {
      const login = wanted.get(key)
      if (!login) this.drop(key)
      else if (login.email && login.email.toLowerCase() !== entry.email.toLowerCase()) {
        // Outro login lá: o que estava na tela era da conta anterior.
        entry.email = login.email
        this.restart(key)
      }
    }
    for (const { key, account, distro, email } of wanted.values()) {
      if (!email || this.monitors.has(key)) continue
      const place = homeUnc(distro) ?? toUnc(distro, '/')
      const entry = { email, account, distro, monitor: null as unknown as UsageMonitor }
      entry.monitor = new UsageMonitor(account, (usage) => this.onUpdate(key, usage), undefined, {
        wsl: { place, running: async () => (await runningDistros()).some((d) => sameDistro(d, distro)) },
        sameLogin: () => this.logins.same(key, account, entry.email, place)
      })
      this.monitors.set(key, entry)
      entry.monitor.start()
    }
  }

  // Entrou de novo na conta dentro da distro, pelo app: o login guardado é outro, mesmo com o mesmo e-mail.
  reconnect(distro: string, account: string): void {
    for (const [key, entry] of this.monitors) if (entry.account === account && sameDistro(entry.distro, distro)) this.restart(key)
  }

  refresh(open = false): void {
    this.monitors.forEach((m) => m.monitor.refresh(open))
  }

  private restart(key: string): void {
    this.logins.forget(key)
    this.monitors.get(key)?.monitor.reconnect()
    this.onUpdate(key, null)
  }

  private drop(key: string): void {
    this.monitors.get(key)?.monitor.stop()
    this.monitors.delete(key)
    this.logins.forget(key)
    this.onUpdate(key, null)
  }

  all(): Record<string, Usage> {
    const out: Record<string, Usage> = {}
    for (const [key, { monitor }] of this.monitors) if (monitor.current) out[key] = monitor.current
    return out
  }

  stop(): void {
    this.closed = true
    this.monitors.forEach((m) => m.monitor.stop())
    this.monitors.clear()
  }
}
