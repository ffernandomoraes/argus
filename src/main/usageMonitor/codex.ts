import { agentRef, type ProviderAccountStatus } from '../../shared/providers'
import type { Usage } from '../../shared/usage'
import { createBackoff } from '../lib/backoff'
import { errorMessage } from '../lib/errors'
import { providerLaunch } from '../providers/env'
import type { JsonRpcProcess } from '../providers/rpc'
import { openCodex } from '../providers/status'
import { codexBuckets, codexUsage, mergeCodexSnapshot, type CodexBuckets, type CodexSnapshot } from './codexParse'
import type { SavedUsages } from './saved'

// Limites de cada conta do Codex. O app-server responde `account/rateLimits/read` sem gastar uso;
// ele abre só para a leitura e fecha em seguida (nada fica aberto entre uma e outra). Durante uma
// conversa, o próprio app-server dela avisa a cada pedido (ver CodexDriver): a barra muda na hora,
// e a leitura periódica só cobre o uso feito fora do app (terminal, extensão do VS Code).

const POLL_MS = 5 * 60_000

// Aviso das conversas abertas (agentChats/codex.ts) para o monitor da conta, sem uma importar a outra.
let onLive: (accountId: string, snapshot: CodexSnapshot) => void = () => {}
export const reportCodexRateLimits = (accountId: string, snapshot: CodexSnapshot) => onLive(accountId, snapshot)

class CodexUsageMonitor {
  private timer: NodeJS.Timeout | null = null
  private rpc: JsonRpcProcess | null = null
  private reading = false
  private stopped = false
  // Muda a cada login trocado: a leitura que já estava no ar responde pela conta anterior.
  private gen = 0
  // Leitura que falhou (sem internet, conta por chave de API, que não tem esse limite): espera cada
  // vez mais, até 1 hora, em vez de abrir o Codex a cada 5 minutos à toa.
  private backoff = createBackoff({ initialMs: POLL_MS, maxMs: 60 * 60_000 })
  private buckets: CodexBuckets = {}
  last: Usage | null = null

  constructor(
    private accountId: string,
    // had: havia uso à vista antes deste aviso.
    private onUpdate: (usage: Usage | null, had: boolean) => void
  ) {}

  start(): void {
    void this.read()
  }

  stop(): void {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.rpc?.close()
    this.rpc = null
  }

  // Login trocado: o que se sabia era da conta anterior, e sai da tela até a leitura do novo.
  reread(): void {
    this.gen++
    this.buckets = {}
    if (this.last) {
      this.last = null
      this.onUpdate(null, true)
    }
    this.backoff.reset()
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    // Com uma leitura no ar, ela mesma chama a próxima ao terminar (ver read).
    void this.read()
  }

  live(snapshot: CodexSnapshot): void {
    this.buckets = mergeCodexSnapshot(this.buckets, snapshot)
    this.publish()
  }

  private async read(): Promise<void> {
    if (this.reading || this.stopped) return
    const launch = providerLaunch('codex', ['app-server'], this.accountId)
    if (!launch) return
    this.reading = true
    const gen = this.gen
    let ok = false
    try {
      this.rpc = await openCodex(launch)
      if (this.stopped || gen !== this.gen) return
      const res = await this.rpc.request<Parameters<typeof codexBuckets>[0]>(
        'account/rateLimits/read',
        // Leitura de fundo: sem a lista dos créditos de reinício, que o app não mostra.
        { excludeResetCreditDetails: true },
        30_000
      )
      if (this.stopped || gen !== this.gen) return
      this.buckets = codexBuckets(res)
      this.publish()
      ok = true
    } catch (err) {
      console.warn('[usage] codex: limites não lidos:', errorMessage(err))
    } finally {
      this.rpc?.close()
      this.rpc = null
      this.reading = false
      if (ok) this.backoff.reset()
      const wait = gen !== this.gen ? 0 : ok ? POLL_MS : this.backoff.next()
      if (!this.stopped) this.timer = setTimeout(() => void this.read(), wait)
    }
  }

  private publish(): void {
    const usage = codexUsage(this.buckets, Date.now())
    const had = !!this.last
    this.last = usage
    this.onUpdate(usage, had)
  }
}

// Um monitor por conta do Codex logada, na mesma chave das conversas ("codex:<id>"). O último uso
// de cada uma fica guardado (ver saved.ts) e só aparece depois de o login dela ser conferido com o
// mesmo e-mail: o app nunca lê o login do Codex por fora.
export class CodexUsageMonitors {
  private monitors = new Map<string, CodexUsageMonitor>()
  // E-mail do login conferido de cada conta, guardado junto com o uso lido.
  private emails = new Map<string, string | undefined>()
  private closed = false

  constructor(
    private onUpdate: (account: string, usage: Usage | null) => void,
    private saved: SavedUsages
  ) {
    onLive = (id, snapshot) => this.monitors.get(id)?.live(snapshot)
  }

  // Cada conferência de login das contas do Codex. Sem status (não deu para conferir), a conta fica
  // como estava.
  sync(accounts: { id: string; status: ProviderAccountStatus | null }[]): void {
    if (this.closed) return
    const ids = new Set(accounts.map((a) => agentRef('codex', a.id)))
    for (const key of this.saved.keys()) if (key.startsWith('codex:') && !ids.has(key)) this.forgetSaved(key)
    for (const { id, status } of accounts) {
      if (!status) continue
      const key = agentRef('codex', id)
      const email = status.signedIn ? status.email : undefined
      // Login trocado por fora (no terminal): o que estava na tela era da conta anterior.
      const changed = this.emails.has(id) && this.emails.get(id) !== email
      this.emails.set(id, email)
      if (changed && status.signedIn) this.monitors.get(id)?.reread()
      const change = this.saved.confirm(key, status)
      if (change && !this.monitors.get(id)?.last) this.onUpdate(key, change === 'shown' ? this.saved.get(key) : null)
    }

    const signedIn = accounts.filter((a) => a.status?.signedIn).map((a) => a.id)
    for (const [id, monitor] of this.monitors) if (!signedIn.includes(id)) this.drop(id, monitor)
    for (const id of signedIn) {
      if (this.monitors.has(id)) continue
      const key = agentRef('codex', id)
      const monitor = new CodexUsageMonitor(id, (usage, had) => {
        if (usage) {
          this.saved.remember(key, usage, this.emails.get(id))
          this.onUpdate(key, usage)
          return
        }
        // Sem limite agora: some o que estava à vista, inclusive o guardado. Sem nada antes, nada a avisar.
        if (this.saved.forget(key) || had) this.onUpdate(key, null)
      })
      this.monitors.set(id, monitor)
      monitor.start()
    }
  }

  // Login trocado: o guardado era do login anterior.
  reread(id: string): void {
    const key = agentRef('codex', id)
    this.emails.delete(id)
    this.forgetSaved(key)
    this.monitors.get(id)?.reread()
  }

  private drop(id: string, monitor: CodexUsageMonitor): void {
    monitor.stop()
    this.monitors.delete(id)
    const key = agentRef('codex', id)
    if (this.saved.forget(key) || monitor.last) this.onUpdate(key, null)
  }

  private forgetSaved(key: string): void {
    if (this.saved.forget(key)) this.onUpdate(key, null)
  }

  all(): Record<string, Usage> {
    const out: Record<string, Usage> = {}
    for (const [id, monitor] of this.monitors) if (monitor.last) out[agentRef('codex', id)] = monitor.last
    return out
  }

  stop(): void {
    this.closed = true
    this.monitors.forEach((m) => m.stop())
    this.monitors.clear()
  }
}
