import { agentRef } from '../../shared/providers'
import type { Usage } from '../../shared/usage'
import { createBackoff } from '../lib/backoff'
import { errorMessage } from '../lib/errors'
import { providerLaunch } from '../providers/env'
import type { JsonRpcProcess } from '../providers/rpc'
import { openCodex } from '../providers/status'
import { codexBuckets, codexUsage, mergeCodexSnapshot, type CodexBuckets, type CodexSnapshot } from './codexParse'

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
    private onUpdate: (usage: Usage | null) => void
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

  // Login trocado: o que se sabia era da conta anterior.
  reread(): void {
    this.gen++
    this.buckets = {}
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
    // Sem limite agora e sem antes: nada a avisar.
    if (!usage && !this.last) return
    this.last = usage
    this.onUpdate(usage)
  }
}

// Um monitor por conta do Codex logada, na mesma chave das conversas ("codex:<id>").
export class CodexUsageMonitors {
  private monitors = new Map<string, CodexUsageMonitor>()
  private closed = false

  constructor(private onUpdate: (account: string, usage: Usage | null) => void) {
    onLive = (id, snapshot) => this.monitors.get(id)?.live(snapshot)
  }

  sync(signedIn: string[]): void {
    if (this.closed) return
    for (const [id, monitor] of this.monitors) if (!signedIn.includes(id)) this.drop(id, monitor)
    for (const id of signedIn) {
      if (this.monitors.has(id)) continue
      const monitor = new CodexUsageMonitor(id, (usage) => this.onUpdate(agentRef('codex', id), usage))
      this.monitors.set(id, monitor)
      monitor.start()
    }
  }

  reread(id: string): void {
    this.monitors.get(id)?.reread()
  }

  private drop(id: string, monitor: CodexUsageMonitor): void {
    monitor.stop()
    this.monitors.delete(id)
    if (monitor.last) this.onUpdate(agentRef('codex', id), null)
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
