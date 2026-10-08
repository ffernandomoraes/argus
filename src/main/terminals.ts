import { existsSync, statSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import { spawn, type IPty } from 'node-pty'
import type { TerminalOpenRequest, TerminalOpenResult } from '../shared/terminal'
import { applyAccount } from './accounts'
import { CLI_BIN } from './cli'
import { claudeCommand, claudePath } from './claudePath'
import { liveStatusByPid } from './liveSessions'
import { expandHome } from './paths'
import { childEnv, defaultShell, IS_WIN, prependPath } from './platform'
import { childrenOf, processTable } from './winProcesses'

// Guarda o fim da saída de cada terminal para redesenhar a tela ao reconectar.
const BUFFER_LIMIT = 200_000

// account: conta do Claude com que o terminal abriu. shell: nome do shell, quando não é o `claude`.
type Session = { pty: IPty; buffer: string; account: string; cwd: string; shell?: string }

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class Terminals {
  private sessions = new Map<string, Session>()
  // Windows: terminais encerrados que ainda não terminaram de fechar (ver closed()).
  private closing = new Set<Promise<void>>()

  constructor(
    private onData: (key: string, data: string) => void,
    private onExit: (key: string, code: number) => void
  ) {}

  open(req: TerminalOpenRequest): TerminalOpenResult {
    const existing = this.sessions.get(req.key)
    if (existing) {
      existing.pty.resize(req.cols, req.rows)
      return { ok: true, buffer: existing.buffer }
    }

    const cwd = expandHome(req.cwd)
    if (!existsSync(cwd) || !statSync(cwd).isDirectory()) {
      return { ok: false, error: `A pasta não existe: ${req.cwd}` }
    }

    const claude = claudePath()
    const env = childEnv()
    env.TERM = 'xterm-256color'
    env.COLORTERM = 'truecolor'
    // App aberto pelo Finder não tem o PATH do terminal; o claude e o node precisam dele.
    // O `argus` entra em todo terminal do app, mesmo sem ter sido instalado no PATH.
    prependPath(env, [CLI_BIN, dirname(claude)])
    // A conta do grupo vale também no shell: o `claude` digitado nele entra com ela.
    const account = applyAccount(env, req.account)

    // No Mac, shell de login, como o Terminal: carrega .zprofile e .zshrc. No Windows, PowerShell.
    const shell = defaultShell()
    const command = claudeCommand([
      ...(req.sessionId ? ['--resume', req.sessionId] : []),
      ...(req.model ? ['--model', req.model] : []),
      ...(req.effort ? ['--effort', req.effort] : []),
      ...(req.settingsJson ? ['--settings', req.settingsJson] : []),
      ...(req.permissionMode ? ['--permission-mode', req.permissionMode] : [])
    ], claude)
    const program = req.shell ? shell.file : command.file

    try {
      const pty = spawn(program, req.shell ? shell.args : command.args, {
        name: 'xterm-256color',
        cols: req.cols,
        rows: req.rows,
        cwd,
        env
      })
      const session: Session = { pty, buffer: '', account, cwd, shell: req.shell ? basename(shell.file) : undefined }
      pty.onData((data) => {
        session.buffer = (session.buffer + data).slice(-BUFFER_LIMIT)
        this.onData(req.key, data)
      })
      pty.onExit(({ exitCode }) => {
        this.sessions.delete(req.key)
        this.onExit(req.key, exitCode)
      })
      this.sessions.set(req.key, session)
      return { ok: true, buffer: '' }
    } catch (err) {
      return { ok: false, error: `Não consegui abrir o ${req.shell ? basename(shell.file) : 'claude'}: ${(err as Error).message}` }
    }
  }

  // Conversa nova que ganhou id de sessão: o terminal já aberto passa a atender pelo id novo,
  // em vez de abrir um segundo `claude` para a mesma conversa.
  rename(oldKey: string, newKey: string): void {
    const session = this.sessions.get(oldKey)
    if (!session || oldKey === newKey) return
    this.sessions.delete(oldKey)
    // Já havia um terminal com esse id (caso raro): fica com o novo e encerra o antigo.
    this.sessions.get(newKey)?.pty.kill()
    this.sessions.set(newKey, session)
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
    this.sessions.delete(key)
    const { pty } = session
    const { pid } = pty
    if (IS_WIN) {
      const done = new Promise<void>((resolve) => pty.onExit(() => resolve()))
      this.closing.add(done)
      void done.then(() => this.closing.delete(done))
    }
    pty.kill()
    // Se não sair com o pedido educado, encerra à força: nada pode ficar rodando atrás.
    setTimeout(() => {
      try {
        process.kill(pid, 0)
        process.kill(pid, 'SIGKILL')
      } catch {
        // já saiu
      }
    }, 2000).unref()
  }

  // Pastas dos terminais com algo em andamento: o `claude` trabalhando ou esperando resposta, ou
  // um comando rodando no shell (o processo da frente não é mais o próprio shell). No Windows o
  // node-pty não diz qual processo está na frente: os shells ficam para o busyShells().
  busy(): string[] {
    const status = liveStatusByPid()
    return [...this.sessions.values()]
      .filter((s) => (s.shell ? !IS_WIN && s.pty.process !== s.shell : (status.get(s.pty.pid) ?? 'idle') !== 'idle'))
      .map((s) => s.cwd)
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
