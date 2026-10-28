import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import { BrowserWindow } from 'electron'
import type { ClaudeInfo } from '../../shared/models'
import type { Usage, UsageFailure } from '../../shared/usage'
import { claudeLaunch } from '../chats'
import { readStored } from '../claudeAuth/store'
import { reportWarning } from '../errorReports'
import { createBackoff } from '../lib/backoff'
import { guardStdin, writeStdin } from '../lib/childProcess'
import { withTimeout } from '../lib/timeout'
import { parseControlReply, parseRateLimits } from './parse'

// Os limites de uso de uma conta do Claude. Vêm do mesmo endereço que o Claude Code consulta para
// o /usage (GET /api/oauth/usage, conferido no binário da 2.1.300), com o login que ele guarda: uma
// chamada a cada 5 minutos com o Argus em foco (15 sem) e outra ao abrir o painel, sem processo aberto. Antes era um `claude` aberto por conta só para isso
// (~155 MB cada, medido em 2026-10-16), o caminho da extensão do VS Code, que já tem um aberto
// para a conversa.
// O `claude` ainda entra em três casos, e fecha ao responder (o pedido de controle get_usage, que
// não envia mensagem nem gasta uso): na abertura, porque a resposta ao "init" traz os modelos e a
// conta do menu do chat; com o login vencido, porque ele renova do jeito dele e grava (o Argus não
// mexe no login por isso); e como reserva, aberto o tempo todo como antes, quando o login não dá
// para ler (WSL, chave de API) ou a chamada direta falha seguidamente (um proxy que só o `claude`
// conhece).

// O relógio do monitor: a cada batida vê se é hora de perguntar (poll) e se o uso está parado.
const TICK_MS = 60_000
// Com uma janela do Argus em foco. Era 1 minuto até a 0.1.88: a cota desse endereço é pequena e
// dividida com todo `claude` aberto com o mesmo login, e a recusa por excesso (429) deixava a tela
// parada (o NodeTerm pergunta a cada 15 minutos). Quem quer o número da hora abre o painel (refresh).
const POLL_MS = 5 * 60_000
// Sem nenhuma janela do Argus em foco, ninguém está olhando a barra. Ao voltar o foco, pergunta na
// hora se a última passou de POLL_MS (ver refresh): perder e voltar o foco várias vezes seguidas não
// faz mais chamadas que antes.
const UNFOCUSED_MS = 15 * 60_000
// Painel aberto: pergunta de novo se a última passou disso. Os prazos do Claude Desktop: 60 s depois
// de uma leitura que deu certo, 20 s depois de uma que falhou.
const OPEN_OK_MS = 60_000
const OPEN_FAILED_MS = 20_000
// O relógio bate a cada minuto e a última pergunta saiu no mesmo ritmo: sem a folga, um atraso de
// milissegundos no relógio pulava uma batida.
const SLACK_MS = 5_000
// A leitura inteira (o login e a chamada), como no Claude Desktop: passou disso, conta como sem
// resposta e não segura as próximas. Sem o prazo, uma leitura do login que não voltava (no Windows,
// o arquivo dentro do WSL travado) deixava o uso parado por horas, sem aviso.
const READ_TIMEOUT_MS = 10_000
// Falhando há mais que isso: um aviso ao Sentry com o estado do monitor, uma vez por parada.
const STALL_MS = 15 * 60_000
// Batida atrasada mais que isso: o computador dormiu, e o tempo dormindo não conta como parada.
const SLEPT_MS = 2 * TICK_MS
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
  // Quando saiu a última pergunta (chamada direta ou o `claude`), para o intervalo com e sem foco.
  private askedAt = 0
  // Leitura do login em andamento: a próxima pergunta espera a mesma, sem empilhar leituras enquanto
  // a anterior (o WSL travado) não volta.
  private tokenRead: ReturnType<typeof readStored> | null = null
  // Por que a leitura mais recente não deu certo; nulo quando deu.
  private failure: NonNullable<Usage['failure']> | null = null
  // Desde quando não dá certo (0: a última deu), e se essa parada já foi avisada ao Sentry.
  private failingSince = 0
  private reported = false
  // O `claude` recebeu a pergunta e ainda não respondeu: o de reserva calado é fechado e reaberto.
  private askedClaudeAt = 0
  private tickedAt = 0
  // A última leitura que deu certo (sem o motivo da falha; para a tela, ver current).
  last: Usage | null = null
  info: ClaudeInfo | null = null

  constructor(
    private account: string,
    private onUpdate: (usage: Usage) => void,
    private onInfo: (info: ClaudeInfo) => void = () => {}
  ) {}

  start(): void {
    this.stopped = false
    // Os modelos, a conta e os primeiros limites; depois, a chamada direta (ver poll).
    this.launch(true)
    this.tickedAt = Date.now()
    this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  // O que a tela mostra: a última leitura que deu certo, com o motivo se a mais recente falhou.
  get current(): Usage | null {
    return this.last && this.failure ? { ...this.last, failure: this.failure } : this.last
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
    this.askedAt = 0
    this.tokenRead = null
    this.failure = null
    this.failingSince = 0
    this.reported = false
    this.askedClaudeAt = 0
    this.backoff.reset()
    this.start()
  }

  // Uma janela do Argus ganhou foco: pergunta já, se a última pergunta passou de POLL_MS. Painel
  // aberto (open): pergunta já, se a última passou de OPEN_OK_MS (ou OPEN_FAILED_MS, falhando).
  refresh(open = false): void {
    void this.poll(open)
  }

  private tick(): void {
    const now = Date.now()
    if (now - this.tickedAt > SLEPT_MS && this.failingSince) this.failingSince = now
    this.tickedAt = now
    this.checkStall(now)
    void this.poll()
  }

  private async poll(open = false): Promise<void> {
    if (this.stopped || this.polling) return
    // O de reserva que não respondeu à última pergunta: fecha, e a próxima batida abre outro.
    if (this.proc && !this.oneShot && this.askedClaudeAt && Date.now() - this.askedClaudeAt > ONE_SHOT_TIMEOUT_MS) {
      this.closeProc()
      this.fail('timeout')
    }
    const every = open
      ? this.failure
        ? OPEN_FAILED_MS
        : OPEN_OK_MS
      : BrowserWindow.getFocusedWindow()
        ? POLL_MS
        : UNFOCUSED_MS
    if (Date.now() - this.askedAt < every - SLACK_MS) return
    // O `claude` aberto responde (o de reserva pergunta a cada minuto; o de uma vez só já perguntou).
    if (this.proc) {
      if (!this.oneShot) this.askUsage()
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
      this.askedAt = Date.now()
      // A leitura atrasada segue e, se voltar, vale (fetchUsage); só deixa de ser esperada.
      if ((await withTimeout(this.read(), READ_TIMEOUT_MS, 'late')) === 'late') this.fail('timeout')
    } finally {
      this.polling = false
    }
  }

  private async read(): Promise<void> {
    const token = await this.validToken()
    if (token === 'none') return this.fallBack()
    if (!token) return this.renewLogin()
    await this.fetchUsage(token)
  }

  // O login da conta: válido; null vencido ou recusado (o `claude` renova); 'none' sem login para
  // ler aqui (chave de API, Chaves inacessíveis, WSL).
  private async validToken(): Promise<Token | null | 'none'> {
    const usable = (t: Token) => t.value !== this.rejected && t.expiresAt - TOKEN_MARGIN_MS > Date.now()
    if (this.token && usable(this.token)) return this.token
    const pending = this.tokenRead ?? readStored(this.account)
    if (!this.tokenRead) {
      this.tokenRead = pending
      void pending.finally(() => this.tokenRead === pending && (this.tokenRead = null))
    }
    const oauth = (await pending)?.claudeAiOauth
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
    } catch (err) {
      return this.failed((err as Error | null)?.name === 'TimeoutError' ? 'timeout' : 'failed')
    }
    if (this.stopped) return
    if (res.status === 401) {
      // O Claude Code pode já ter renovado: a próxima leitura das Chaves traz o novo; se for o
      // mesmo, o `claude` renova (renewLogin). Na próxima batida, sem esperar o intervalo.
      this.rejected = token.value
      this.token = null
      this.askedAt = 0
      return this.fail('login')
    }
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after')) * 1000
      this.quietUntil = Date.now() + (wait > 0 ? wait : QUIET_MS)
      return this.fail('rate_limited', this.quietUntil)
    }
    const usage = res.ok ? parseRateLimits(await res.json().catch(() => null), token.plan, Date.now()) : null
    if (!usage) return this.failed('failed')
    this.failures = 0
    this.succeeded(usage)
  }

  private failed(reason: UsageFailure): void {
    this.fail(reason)
    if (++this.failures >= MAX_FAILURES) this.fallBack()
  }

  private succeeded(usage: Usage): void {
    this.failure = null
    this.failingSince = 0
    this.reported = false
    this.askedClaudeAt = 0
    this.askedAt = Date.now()
    this.last = usage
    this.onUpdate(usage)
  }

  // A leitura não deu certo: a tela segue com os últimos números, marcados com o motivo.
  private fail(reason: UsageFailure, retryAt?: number): void {
    if (this.stopped) return
    this.failure = retryAt ? { reason, retryAt } : { reason }
    this.failingSince ||= Date.now()
    if (this.last) this.onUpdate(this.current!)
  }

  // Parado há STALL_MS: vai ao Sentry o que o monitor sabe, para achar a causa sem pedir nada a quem
  // usa (a parada de 2026-10-26 no Windows com WSL não deixou rastro). Recusado por excesso (429) e
  // ainda no prazo que o endereço pediu, o monitor está só esperando: não é parada (ARGUS-A,
  // 2026-10-28, com 45 minutos de espera pela frente).
  private checkStall(now: number): void {
    if (!this.failingSince || this.reported || now - this.failingSince < STALL_MS) return
    if (this.failure?.reason === 'rate_limited' && now < this.quietUntil) return
    this.reported = true
    const minutes = (since: number) => Math.round((now - since) / 60_000)
    reportWarning('Uso do Claude sem atualizar', {
      reason: this.failure?.reason ?? null,
      failingMinutes: minutes(this.failingSince),
      minutesSinceLastRead: this.last ? minutes(this.last.updatedAt) : null,
      persistent: this.persistent,
      claudeOpen: !!this.proc,
      oneShot: this.oneShot,
      relaunchPending: !!this.restart,
      claudeSilentMinutes: this.askedClaudeAt ? minutes(this.askedClaudeAt) : null,
      loginReadPending: !!this.tokenRead,
      tokenRejected: !!this.rejected,
      failures: this.failures,
      quietSeconds: Math.max(0, Math.round((this.quietUntil - now) / 1000)),
      renewedMinutesAgo: this.renewedAt ? minutes(this.renewedAt) : null
    })
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
    this.fail('login')
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
        this.fail('failed')
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
      // Caiu sem responder à pergunta.
      if (this.askedClaudeAt) this.fail('failed')
      this.askedClaudeAt = 0
      if (!oneShot && !this.stopped) this.relaunchLater()
    })

    this.send({ subtype: 'initialize' }, 'init')
    this.askUsage()
    if (oneShot) {
      this.oneShotTimer = setTimeout(() => {
        if (this.proc !== proc) return
        const silent = !!this.askedClaudeAt
        this.closeProc()
        if (silent) this.fail('timeout')
      }, ONE_SHOT_TIMEOUT_MS)
    }
  }

  // O de reserva caiu (ou nem abriu): reabre depois de esperar (backoff).
  private relaunchLater(): void {
    this.restart = setTimeout(() => {
      this.restart = null
      this.launch(false)
    }, this.backoff.next())
  }

  // O de uma vez só não conta como pergunta do intervalo: se ele não responder (o da abertura, por
  // exemplo), a chamada direta não espera POLL_MS. Respondendo, conta (succeeded).
  private askUsage(): void {
    const now = Date.now()
    if (!this.oneShot) this.askedAt = now
    this.askedClaudeAt ||= now
    this.send({ subtype: 'get_usage', skip_behaviors: true }, `usage-${++this.seq}`)
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
      this.succeeded(reply.usage)
      // O `claude` pode ter renovado o login: a próxima chamada direta relê das Chaves.
      this.token = null
    }
    return reply
  }

  private closeProc(): void {
    const proc = this.proc
    this.proc = null
    this.askedClaudeAt = 0
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
