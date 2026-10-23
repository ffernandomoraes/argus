import type { IPty } from 'node-pty'
import type { TerminalOpenRequest, TerminalOpenResult } from '../../shared/terminal'
import { tr } from '../i18n'
import { liveStatusByPid, liveStatusBySessionSync } from '../liveSessions'
import { expandHome, isDirectory } from '../paths'
import { IS_WIN } from '../platform'
import { childrenOf, processTable } from '../winProcesses'
import { forceKillLater } from './forceKill'
import { OutputBuffer } from './outputBuffer'
import { diskLookup, watchSession } from './sessionBinding'
import { spawnTerminal } from './spawnTerminal'

// Guarda o fim da saída de cada terminal para redesenhar a tela ao reconectar.
const BUFFER_LIMIT = 200_000
// A saída vai para a janela em lotes: o `claude` no terminal redesenha a tela aos pedacinhos, e cada
// pedaço virava uma mensagem e uma escrita no xterm (o VS Code junta do mesmo jeito, a cada 5 ms).
// Quem digita não sente a diferença.
const SEND_EVERY_MS = 5

// key: a chave com que o terminal atende. account: conta do Claude com que
// o terminal abriu. shell: nome do shell, quando não é o `claude`. sessionId: a conversa do
// `claude` (a retomada, ou a que ele criou, achada pelo pid). unwatch: para a procura dela.
type Session = {
  key: string
  pty: IPty
  output: OutputBuffer
  account: string
  cwd: string
  shell?: string
  sessionId?: string
  // Roda no WSL: o status vem pelo id da conversa, não pelo pid (ver busy).
  wsl?: boolean
  unwatch?: () => void
  // Saída que ainda não foi para a janela (ver SEND_EVERY_MS).
  pending: string[]
  sendTimer?: NodeJS.Timeout
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class Terminals {
  private sessions = new Map<string, Session>()
  // Terminais abrindo (o do WSL espera a distro responder): um segundo pedido na mesma chave espera
  // o primeiro, em vez de abrir outro processo.
  private opening = new Map<string, Promise<TerminalOpenResult>>()
  // Windows: terminais encerrados que ainda não terminaram de fechar (ver closed()).
  private closing = new Set<Promise<void>>()

  constructor(
    private onData: (key: string, data: string) => void,
    private onExit: (key: string, code: number) => void,
    // O `claude` aberto sem conversa já gravou a dele (ver sessionBinding.ts).
    private onSession: (key: string, sessionId: string) => void
  ) {}

  async open(req: TerminalOpenRequest): Promise<TerminalOpenResult> {
    const pending = this.opening.get(req.key)
    if (pending) await pending
    const existing = this.sessions.get(req.key)
    if (existing) {
      if (!req.keepSize) existing.pty.resize(req.cols, req.rows)
      // O lote pendente já está no buffer: sai antes da resposta, que a tela ainda descarta, em
      // vez de chegar depois e repetir o fim.
      this.send(existing)
      return { ok: true, buffer: existing.output.text() }
    }
    const p = this.start(req)
    this.opening.set(req.key, p)
    try {
      return await p
    } finally {
      if (this.opening.get(req.key) === p) this.opening.delete(req.key)
    }
  }

  private async start(req: TerminalOpenRequest): Promise<TerminalOpenResult> {
    const cwd = expandHome(req.cwd)
    if (!isDirectory(cwd)) return { ok: false, error: tr(`A pasta não existe: ${req.cwd}`, `Folder doesn’t exist: ${req.cwd}`) }
    const opened = await spawnTerminal(req, cwd)
    if (!opened.ok) return opened

    const session: Session = {
      key: req.key,
      pty: opened.pty,
      output: new OutputBuffer(BUFFER_LIMIT),
      account: opened.account,
      cwd,
      shell: opened.shell,
      sessionId: req.shell ? undefined : req.sessionId,
      wsl: opened.wsl,
      pending: []
    }
    // Só a sessão que ainda ocupa a chave fala por ela. Terminal fechado e reaberto na mesma chave
    // (desfazer logo depois de fechar): a saída e o fim do antigo chegam depois (no Windows, ~1 s)
    // e apagariam o novo, que ficaria órfão, fora do busy() e do killAll() ao sair.
    const current = () => this.sessions.get(session.key) === session
    session.pty.onData((data) => {
      if (!current()) return
      session.output.push(data)
      session.pending.push(data)
      session.sendTimer ??= setTimeout(() => this.send(session), SEND_EVERY_MS)
    })
    session.pty.onExit(({ exitCode }) => {
      session.unwatch?.()
      if (!current()) return
      this.send(session)
      this.sessions.delete(session.key)
      this.onExit(session.key, exitCode)
    })
    // `claude` sem conversa: acompanha pelo pid qual ele cria. No WSL o id já veio escolhido;
    // espera só a conversa aparecer gravada.
    if (!req.shell && !req.sessionId) {
      const found = (id: string) => {
        session.unwatch = undefined
        session.sessionId = id
        if (current()) this.onSession(session.key, id)
      }
      const chosen = opened.newSession
      session.unwatch = chosen
        ? watchSession(session.pty.pid, cwd, found, { ...diskLookup, sessionOf: () => chosen })
        : watchSession(session.pty.pid, cwd, found)
    }
    this.sessions.set(req.key, session)
    return { ok: true, buffer: '' }
  }

  // Manda à janela a saída juntada. Também antes do fim do terminal, para ela chegar antes do aviso.
  private send(session: Session): void {
    clearTimeout(session.sendTimer)
    session.sendTimer = undefined
    const data = session.pending.join('')
    session.pending = []
    // Fechado e reaberto na mesma chave: o resto do antigo não vai para o novo (ver current()).
    if (data && this.sessions.get(session.key) === session) this.onData(session.key, data)
  }

  // Conversa do `claude` do terminal; nula no shell e enquanto a dele não foi gravada.
  sessionOf(key: string): string | null {
    return this.sessions.get(key)?.sessionId ?? null
  }

  has(key: string): boolean {
    return this.sessions.has(key)
  }

  write(key: string, data: string): void {
    this.sessions.get(key)?.pty.write(data)
  }

  resize(key: string, cols: number, rows: number): void {
    if (cols > 0 && rows > 0) this.sessions.get(key)?.pty.resize(cols, rows)
  }

  kill(key: string): void {
    const session = this.sessions.get(key)
    if (!session) return
    this.send(session)
    this.sessions.delete(key)
    session.unwatch?.()
    // Fora do mapa, o fim real do processo é descartado (current() em open): a janela fica sabendo
    // aqui, com -1 (encerrado pelo app, não pelo próprio processo).
    this.onExit(key, -1)
    const { pty } = session
    if (IS_WIN) {
      const done = new Promise<void>((resolve) => pty.onExit(() => resolve()))
      this.closing.add(done)
      void done.then(() => this.closing.delete(done))
    }
    pty.kill()
    forceKillLater(pty.pid)
  }

  // Pastas dos terminais com algo em andamento: o `claude` trabalhando ou esperando resposta, ou
  // um comando rodando no shell (o processo da frente não é mais o próprio shell). No Windows o
  // node-pty não diz qual processo está na frente: os shells ficam para o busyShells().
  busy(): string[] {
    const status = liveStatusByPid()
    const wsl = [...this.sessions.values()].some((s) => s.wsl) ? liveStatusBySessionSync() : null
    const claudeStatus = (s: Session) => (s.wsl ? (s.sessionId && wsl?.get(s.sessionId)) : status.get(s.pty.pid)) || 'idle'
    return [...this.sessions.values()]
      .filter((s) => (s.shell ? !IS_WIN && s.pty.process !== s.shell : claudeStatus(s) !== 'idle'))
      .map((s) => s.cwd)
  }

  // Para o relatório de erro (ver errorReports).
  count(): number {
    return this.sessions.size
  }

  // Algum `claude` de terminal trabalhando agora (app/keepAwake.ts); nulo sem terminal do `claude`
  // para conferir. Os do WSL ficam de fora: ler o status deles acorda a máquina virtual do WSL.
  claudeWorking(): boolean | null {
    const local = [...this.sessions.values()].filter((s) => !s.shell && !s.wsl)
    if (!local.length) return null
    const status = liveStatusByPid()
    return local.some((s) => status.get(s.pty.pid) === 'running')
  }

  // Windows: shell com algum programa aberto por ele (um `pnpm dev`, um build) está ocupado. Leva
  // um instante, porque lê a tabela de processos do sistema.
  hasShells(): boolean {
    return IS_WIN && [...this.sessions.values()].some((s) => s.shell)
  }

  // Sem resposta em 5 segundos, conta todos os shells como ocupados: melhor perguntar à toa do que
  // fechar o app com um comando no meio.
  async busyShells(): Promise<string[]> {
    const shells = [...this.sessions.values()].filter((s) => s.shell)
    if (!IS_WIN || !shells.length) return []
    const table = await Promise.race([processTable(0), new Promise<null>((r) => setTimeout(() => r(null), 5000))])
    return shells.filter((s) => !table || childrenOf(table, s.pty.pid).length > 0).map((s) => s.cwd)
  }

  killAll(): void {
    for (const key of [...this.sessions.keys()]) this.kill(key)
  }

  // Windows: o kill do node-pty fecha o terminal aos poucos. Uma thread ainda esvazia a saída do
  // ConPTY por cerca de 1 s, e o app que sai antes disso cai ao sair (código 0xC0000409, visto no
  // teste do GitHub). Quem vai sair espera aqui: o aviso de fim de cada terminal e esse 1 s da
  // thread (no máximo 3 s), mais um respiro.
  hasClosing(): boolean {
    return this.closing.size > 0
  }

  async closed(): Promise<void> {
    if (!this.closing.size) return
    await Promise.race([Promise.all([...this.closing, wait(1100)]), wait(3000)])
    await wait(300)
  }

  // Conta removida: o login dela some, então os terminais dela também.
  killAccount(account: string): void {
    for (const [key, s] of [...this.sessions]) if (s.account === account) this.kill(key)
  }
}
