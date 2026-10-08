import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { homedir } from 'node:os'
import { createInterface } from 'node:readline'
import type { ClaudeInfo, ClaudeModel } from '../shared/models'
import type { Usage, UsageWindow } from '../shared/usage'
import { claudeEnv } from './chats'
import { claudeCommand, claudePath } from './claudePath'

// Mesmo caminho da extensão do VS Code: um `claude` em modo stream-json fica aberto
// e responde ao pedido de controle `get_usage`, sem enviar mensagem nem gastar uso.
// O pedido é marcado como experimental pelo Claude Code e pode mudar entre versões.
// Um processo por conta logada: cada uma tem os próprios limites.

const POLL_MS = 60_000
const RESTART_MS = 30_000

type RawWindow = { utilization?: number; resets_at?: string } | null | undefined

type RawModel = { value: string; displayName: string; description?: string; supportedEffortLevels?: string[] }

function toModels(raw: RawModel[]): ClaudeModel[] {
  return raw.map((m) => {
    const isDefault = m.value === 'default'
    return {
      value: isDefault ? '' : m.value,
      displayName: isDefault ? 'Padrão' : m.displayName,
      // A descrição do padrão começa com o nome do modelo atual: "Opus 5.5 · Best for...".
      resolvedName: isDefault ? m.description?.split(' · ')[0] : undefined,
      efforts: m.supportedEffortLevels ?? []
    }
  })
}

function toWindow(raw: RawWindow): UsageWindow | null {
  if (!raw || typeof raw.utilization !== 'number' || !raw.resets_at) return null
  return { percent: raw.utilization, resetsAt: raw.resets_at }
}

export class UsageMonitor {
  private proc: ChildProcessWithoutNullStreams | null = null
  private timer: NodeJS.Timeout | null = null
  private restart: NodeJS.Timeout | null = null
  private stopped = false
  private seq = 0
  last: Usage | null = null
  info: ClaudeInfo | null = null

  constructor(
    private account: string,
    private onUpdate: (usage: Usage) => void,
    private onInfo: (info: ClaudeInfo) => void = () => {}
  ) {}

  start(): void {
    this.stopped = false
    const claude = claudePath()
    const cmd = claudeCommand(
      ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--no-session-persistence'],
      claude
    )
    // windowsHide: sem ele, o Windows mostraria uma janela de terminal para este `claude` escondido.
    const proc = spawn(cmd.file, cmd.args, { cwd: homedir(), env: claudeEnv(claude, this.account), windowsHide: true })
    this.proc = proc

    createInterface({ input: proc.stdout }).on('line', (line) => this.onLine(line))
    proc.stderr.on('data', () => {})
    proc.on('error', (err) => console.warn('[usage] falha ao iniciar o claude:', err.message))
    proc.on('exit', () => {
      // Já trocado por um novo (restart): não mexe no que é dele.
      if (this.proc !== proc) return
      this.clearTimer()
      this.proc = null
      if (!this.stopped) this.restart = setTimeout(() => this.start(), RESTART_MS)
    })

    this.send({ subtype: 'initialize' }, 'init')
    this.poll()
    this.timer = setInterval(() => this.poll(), POLL_MS)
  }

  stop(): void {
    this.stopped = true
    this.clearTimer()
    if (this.restart) clearTimeout(this.restart)
    this.proc?.kill()
    this.proc = null
  }

  // Conta trocada: o `claude` aberto guardou o login antigo e responderia pela conta anterior.
  reconnect(): void {
    this.stop()
    this.last = null
    this.info = null
    this.start()
  }

  private poll(): void {
    this.send({ subtype: 'get_usage', skip_behaviors: true }, `usage-${++this.seq}`)
  }

  private send(request: Record<string, unknown>, id = `req-${++this.seq}`): void {
    this.proc?.stdin.write(JSON.stringify({ type: 'control_request', request_id: id, request }) + '\n')
  }

  private onLine(line: string): void {
    let msg: any
    try {
      msg = JSON.parse(line)
    } catch {
      return
    }
    const res = msg?.type === 'control_response' ? msg.response : null
    if (!res || res.subtype !== 'success') return

    if (res.request_id === 'init' && Array.isArray(res.response?.models)) {
      const mode = res.response.current_permission_mode
      this.info = {
        models: toModels(res.response.models),
        // Na resposta o modo manual vem como "default"; o --permission-mode chama de "manual".
        defaultPermissionMode: !mode || mode === 'default' ? 'manual' : mode,
        account: res.response.account ?? null
      }
      this.onInfo(this.info)
      return
    }
    if (!String(res.request_id).startsWith('usage-')) return

    const limits = res.response?.rate_limits
    if (!limits) return
    this.last = {
      session: toWindow(limits.five_hour),
      weekly: toWindow(limits.seven_day),
      updatedAt: Date.now()
    }
    this.onUpdate(this.last)
  }

  private clearTimer(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}

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
