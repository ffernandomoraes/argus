import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { ClaudeInfo } from '../../shared/models'
import type { Usage } from '../../shared/usage'
import { claudeLaunch } from '../chats'
import { readStored } from '../claudeAuth/store'
import { createBackoff } from '../lib/backoff'
import { guardStdin, writeStdin } from '../lib/childProcess'
import { parseControlReply, parseRateLimits } from './parse'

// Os limites de uso de uma conta do Claude. Vêm do mesmo endereço que o Claude Code consulta para
// o /usage (GET /api/oauth/usage, conferido no binário da 2.1.300), com o login que ele guarda: uma
// chamada por minuto, sem processo aberto. Antes era um `claude` aberto por conta só para isso
// (~155 MB cada, medido em 2026-10-16), o caminho da extensão do VS Code, que já tem um aberto
// para a conversa.
// O `claude` ainda entra em três casos, e fecha ao responder (o pedido de controle get_usage, que
// não envia mensagem nem gasta uso): na abertura, porque a resposta ao "init" traz os modelos e a
// conta do menu do chat; com o login vencido, porque ele renova do jeito dele e grava (o Argus não
// mexe no login por isso); e como reserva, aberto o tempo todo como antes, quando o login não dá
// para ler (WSL, chave de API) ou a chamada direta falha seguidamente (um proxy que só o `claude`
// conhece).

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

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'
const OAUTH_BETA = 'oauth-2025-04-20'
const FETCH_TIMEOUT_MS = 10_000
// Recusou por excesso (429): espera o que o servidor pedir, ou isto.
const QUIET_MS = 5 * 60_000
// Perto de vencer, o login não serve: o `claude` renova.
const TOKEN_MARGIN_MS = 60_000
// O `claude` de uma vez só que não respondeu fecha depois disto.
const ONE_SHOT_TIMEOUT_MS = 60_000
// Entre um e outro para renovar o login: sem conseguir (sessão encerrada), não abre um por minuto.
const RENEW_GAP_MS = 10 * 60_000
// Chamadas diretas que falham em seguida (rede, resposta estranha) antes de voltar ao `claude` aberto.
const MAX_FAILURES = 3

type Token = { value: string; expiresAt: number; plan: unknown }

export class UsageMonitor {
  private proc: ChildProcessWithoutNullStreams | null = null
  // O `claude` aberto agora é o de uma vez só (fecha ao responder), não o de reserva.
  private oneShot = false
  private oneShotTimer: NodeJS.Timeout | null = null
  // A chamada direta não serve para esta conta: fica o `claude` aberto, como antes.
  private persistent = false
  private timer: NodeJS.Timeout | null = null
  private restart: NodeJS.Timeout | null = null
  // Caiu de novo sem responder: espera cada vez mais para reabrir (30 s, 1 min... até 10 min),
  // sem martelar um `claude` que não abre. Volta ao início quando ele responde.
  private backoff = createBackoff({ initialMs: 30_000, maxMs: 10 * 60_000 })
  private stopped = false
  private seq = 0
  // Cada start; um anterior que ainda esperava o WSL não abre nada (ver launch).
  private starts = 0
  // O login, guardado até perto de vencer: ler as Chaves do macOS a cada minuto abriria um processo.
  private token: Token | null = null
  // O servidor recusou este login (401): não usa mais, espera o `claude` renovar.
  private rejected: string | null = null
  private quietUntil = 0
  private renewedAt = 0
  private failures = 0
  private polling = false
  last: Usage | null = null
  info: ClaudeInfo | null = null

  constructor(
    private account: string,
    private onUpdate: (usage: Usage) => void,
    private onInfo: (info: ClaudeInfo) => void = () => {}
  ) {}

  start(): void {
    this.stopped = false
    // Os modelos, a conta e os primeiros limites; depois, a chamada direta a cada minuto.
    this.launch(true)
    this.timer = setInterval(() => void this.poll(), POLL_MS)
  }

  stop(): void {
    this.stopped = true
    this.starts++
    this.clearTimer()
    if (this.restart) clearTimeout(this.restart)
    this.restart = null
    this.closeProc()
  }

  // Conta trocada: o `claude` aberto guardou o login antigo e responderia pela conta anterior.
  reconnect(): void {
    this.stop()
    this.last = null
    this.info = null
    this.token = null
    this.rejected = null
    this.persistent = false
    this.failures = 0
    this.quietUntil = 0
    this.renewedAt = 0
    this.backoff.reset()
    this.start()
  }

  private async poll(): Promise<void> {
    if (this.stopped || this.polling) return
    // O `claude` aberto responde (o de reserva pergunta a cada minuto; o de uma vez só já perguntou).
    if (this.proc) {
      if (!this.oneShot) this.send({ subtype: 'get_usage', skip_behaviors: true }, `usage-${++this.seq}`)
      return
    }
    // Na reserva, sem `claude` aberto (o de uma vez só fechou depois que ela foi escolhida): abre o
    // de reserva. Caído e esperando para reabrir (restart), não.
    if (this.persistent) {
      if (!this.restart) this.launch(false)
      return
    }
    if (Date.now() < this.quietUntil) return
    this.polling = true
    try {
      const token = await this.validToken()
      if (token === 'none') return this.fallBack()
      if (!token) return this.renewLogin()
      await this.fetchUsage(token)
    } finally {
      this.polling = false
    }
  }

  // O login da conta: válido; null vencido ou recusado (o `claude` renova); 'none' sem login para
  // ler aqui (chave de API, Chaves inacessíveis, WSL).
  private async validToken(): Promise<Token | null | 'none'> {
    const usable = (t: Token) => t.value !== this.rejected && t.expiresAt - TOKEN_MARGIN_MS > Date.now()
    if (this.token && usable(this.token)) return this.token
    const oauth = (await readStored(this.account))?.claudeAiOauth
    if (!oauth?.accessToken) return 'none'
    this.token = { value: oauth.accessToken, expiresAt: oauth.expiresAt ?? Infinity, plan: oauth.subscriptionType ?? null }
    return usable(this.token) ? this.token : null
  }

  private async fetchUsage(token: Token): Promise<void> {
    let res: Response
    try {
      res = await fetch(USAGE_URL, {
        headers: { Authorization: `Bearer ${token.value}`, 'anthropic-beta': OAUTH_BETA, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      })
    } catch {
      return this.failed()
    }
    if (this.stopped) return
    if (res.status === 401) {
      // O Claude Code pode já ter renovado: a próxima leitura das Chaves traz o novo; se for o
      // mesmo, o `claude` renova (renewLogin).
      this.rejected = token.value
      this.token = null
      return
    }
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after')) * 1000
      this.quietUntil = Date.now() + (wait > 0 ? wait : QUIET_MS)
      return
    }
    const usage = res.ok ? parseRateLimits(await res.json().catch(() => null), token.plan, Date.now()) : null
    if (!usage) return this.failed()
    this.failures = 0
    this.last = usage
    this.onUpdate(usage)
  }

  private failed(): void {
    if (++this.failures >= MAX_FAILURES) this.fallBack()
  }

  // A chamada direta não serve para esta conta: o `claude` aberto, como antes.
  private fallBack(): void {
    if (this.persistent) return
    this.persistent = true
    console.warn('[usage] sem a chamada direta para esta conta; segue com o `claude` aberto')
    if (!this.proc) this.launch(false)
  }

  // Login vencido: o `claude` de uma vez só renova e grava (e traz os limites).
  private renewLogin(): void {
    if (Date.now() - this.renewedAt < RENEW_GAP_MS) return
    this.renewedAt = Date.now()
    this.token = null
    this.launch(true)
  }

  // oneShot: fecha ao responder (o "init" e os limites). Senão, fica aberto e reabre se cair.
  private launch(oneShot: boolean): void {
    const seq = ++this.starts
    // No WSL, espera a distro responder na primeira vez (ver claudeLaunch).
    void claudeLaunch(ARGS, this.account).then((l) => {
      if (this.stopped || seq !== this.starts || this.proc) return
      if (!l.ok) {
        console.warn('[usage] falha ao iniciar o claude:', l.error)
        if (!oneShot) this.relaunchLater()
        return
      }
      // windowsHide: sem ele, o Windows mostraria uma janela de terminal para este `claude` escondido.
      this.attach(spawn(l.file, l.args, { cwd: l.cwd, env: l.env, windowsHide: true }), oneShot)
    })
  }

  private attach(proc: ChildProcessWithoutNullStreams, oneShot: boolean): void {
    this.proc = proc
    this.oneShot = oneShot
    // O poll pode escrever num `claude` que morreu antes do aviso de saída: sem ouvinte, o EPIPE
    // derrubaria o processo principal.
    guardStdin(proc)

    let gotInfo = false
    let gotUsage = false
    createInterface({ input: proc.stdout }).on('line', (line) => {
      const reply = this.onLine(line)
      gotInfo ||= !!reply?.info
      gotUsage ||= !!reply?.usage
      // O de uma vez só já deu o que tinha a dar.
      if (oneShot && gotInfo && gotUsage && this.proc === proc) this.closeProc()
    })
    proc.stderr.on('data', () => {})
    proc.on('error', (err) => console.warn('[usage] falha ao iniciar o claude:', err.message))
    // 'close' e não 'exit': quando o `claude` nem abre (não achado), vêm só 'error' e 'close'.
    proc.on('close', () => {
      // Já trocado por um novo (restart): não mexe no que é dele.
      if (this.proc !== proc) return
      this.proc = null
      this.clearOneShotTimer()
      if (!oneShot && !this.stopped) this.relaunchLater()
    })

    this.send({ subtype: 'initialize' }, 'init')
    this.send({ subtype: 'get_usage', skip_behaviors: true }, `usage-${++this.seq}`)
    if (oneShot) this.oneShotTimer = setTimeout(() => this.proc === proc && this.closeProc(), ONE_SHOT_TIMEOUT_MS)
  }

  // O de reserva caiu (ou nem abriu): reabre depois de esperar (backoff).
  private relaunchLater(): void {
    this.restart = setTimeout(() => {
      this.restart = null
      this.launch(false)
    }, this.backoff.next())
  }

  private send(request: Record<string, unknown>, id = `req-${++this.seq}`): void {
    if (this.proc) writeStdin(this.proc, JSON.stringify({ type: 'control_request', request_id: id, request }) + '\n', { end: false })
  }

  private onLine(line: string): ReturnType<typeof parseControlReply> {
    const reply = parseControlReply(line, Date.now())
    if (!reply) return null
    // Respondeu: a próxima queda volta a esperar só o mínimo.
    this.backoff.reset()
    if (reply.info) {
      this.info = reply.info
      this.onInfo(reply.info)
    }
    if (reply.usage) {
      this.last = reply.usage
      this.onUpdate(reply.usage)
      // O `claude` pode ter renovado o login: a próxima chamada direta relê das Chaves.
      this.token = null
    }
    return reply
  }

  private closeProc(): void {
    const proc = this.proc
    this.proc = null
    this.clearOneShotTimer()
    proc?.kill()
  }

  private clearOneShotTimer(): void {
    if (this.oneShotTimer) clearTimeout(this.oneShotTimer)
    this.oneShotTimer = null
  }

  private clearTimer(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}
