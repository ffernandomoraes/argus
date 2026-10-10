import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { homedir } from 'node:os'
import { createInterface } from 'node:readline'
import type { ClaudeInfo } from '../../shared/models'
import type { Usage } from '../../shared/usage'
import { claudeEnv } from '../chats'
import { claudeCommand, claudePath } from '../claudePath'
import { createBackoff } from '../lib/backoff'
import { guardStdin, writeStdin } from '../lib/childProcess'
import { parseControlReply } from './parse'

// Mesmo caminho da extensão do VS Code: um `claude` em modo stream-json fica aberto
// e responde ao pedido de controle `get_usage`, sem enviar mensagem nem gastar uso.
// O pedido é marcado como experimental pelo Claude Code e pode mudar entre versões.
// Um processo por conta logada: cada uma tem os próprios limites.

const POLL_MS = 60_000
// --strict-mcp-config sem --mcp-config: nenhum MCP. Só para ler o limite, subir os MCPs da pessoa
// custava centenas de MB por conta (o Playwright, por exemplo).
const ARGS = [
  '-p',
  '--input-format',
  'stream-json',
  '--output-format',
  'stream-json',
  '--verbose',
  '--no-session-persistence',
  '--strict-mcp-config'
]

export class UsageMonitor {
  private proc: ChildProcessWithoutNullStreams | null = null
  private timer: NodeJS.Timeout | null = null
  private restart: NodeJS.Timeout | null = null
  // Caiu de novo sem responder: espera cada vez mais para reabrir (30 s, 1 min... até 10 min),
  // sem martelar um `claude` que não abre. Volta ao início quando ele responde.
  private backoff = createBackoff({ initialMs: 30_000, maxMs: 10 * 60_000 })
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
    const cmd = claudeCommand(ARGS, claude)
    // windowsHide: sem ele, o Windows mostraria uma janela de terminal para este `claude` escondido.
    const proc = spawn(cmd.file, cmd.args, { cwd: homedir(), env: claudeEnv(claude, this.account), windowsHide: true })
    this.proc = proc
    // O poll pode escrever num `claude` que morreu antes do aviso de saída: sem ouvinte, o EPIPE
    // derrubaria o processo principal.
    guardStdin(proc)

    createInterface({ input: proc.stdout }).on('line', (line) => this.onLine(line))
    proc.stderr.on('data', () => {})
    proc.on('error', (err) => console.warn('[usage] falha ao iniciar o claude:', err.message))
    // 'close' e não 'exit': quando o `claude` nem abre (não achado), vêm só 'error' e 'close'.
    proc.on('close', () => {
      // Já trocado por um novo (restart): não mexe no que é dele.
      if (this.proc !== proc) return
      this.clearTimer()
      this.proc = null
      if (!this.stopped) this.restart = setTimeout(() => this.start(), this.backoff.next())
    })

    this.send({ subtype: 'initialize' }, 'init')
    this.poll()
    this.timer = setInterval(() => this.poll(), POLL_MS)
  }

  stop(): void {
    this.stopped = true
    this.clearTimer()
    if (this.restart) clearTimeout(this.restart)
    this.restart = null
    this.proc?.kill()
    this.proc = null
  }

  // Conta trocada: o `claude` aberto guardou o login antigo e responderia pela conta anterior.
  reconnect(): void {
    this.stop()
    this.last = null
    this.info = null
    this.backoff.reset()
    this.start()
  }

  private poll(): void {
    this.send({ subtype: 'get_usage', skip_behaviors: true }, `usage-${++this.seq}`)
  }

  private send(request: Record<string, unknown>, id = `req-${++this.seq}`): void {
    if (this.proc) writeStdin(this.proc, JSON.stringify({ type: 'control_request', request_id: id, request }) + '\n', { end: false })
  }

  private onLine(line: string): void {
    const reply = parseControlReply(line, Date.now())
    if (!reply) return
    // Respondeu: a próxima queda volta a esperar só o mínimo.
    this.backoff.reset()
    if (reply.info) {
      this.info = reply.info
      this.onInfo(reply.info)
    }
    if (reply.usage) {
      this.last = reply.usage
      this.onUpdate(reply.usage)
    }
  }

  private clearTimer(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}
