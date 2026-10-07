import { existsSync, statSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import { spawn, type IPty } from 'node-pty'
import type { TerminalOpenRequest, TerminalOpenResult } from '../shared/terminal'
import { applyAccount } from './accounts'
import { CLI_BIN } from './cli'
import { claudePath } from './claudePath'
import { liveStatusByPid } from './liveSessions'
import { expandHome } from './paths'

// Guarda o fim da saída de cada terminal para redesenhar a tela ao reconectar.
const BUFFER_LIMIT = 200_000

// account: conta do Claude com que o terminal abriu. shell: nome do shell, quando não é o `claude`.
type Session = { pty: IPty; buffer: string; account: string; cwd: string; shell?: string }

export class Terminals {
  private sessions = new Map<string, Session>()

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
    const env = { ...process.env } as Record<string, string>
    delete env.ELECTRON_RUN_AS_NODE
    delete env.ELECTRON_NO_ATTACH_CONSOLE
    env.TERM = 'xterm-256color'
    env.COLORTERM = 'truecolor'
    // App aberto pelo Finder não tem o PATH do terminal; o claude e o node precisam dele.
    // O `argus` entra em todo terminal do app, mesmo sem ter sido instalado no PATH.
    env.PATH = [CLI_BIN, dirname(claude), '/opt/homebrew/bin', '/usr/local/bin', env.PATH].filter(Boolean).join(':')
    // A conta do grupo vale também no shell: o `claude` digitado nele entra com ela.
    const account = applyAccount(env, req.account)

    // Shell de login, como o Terminal do macOS: carrega .zprofile e .zshrc.
    const shell = process.env.SHELL || '/bin/zsh'
    const program = req.shell ? shell : claude

    try {
      const args = req.shell ? ['-l'] : [
        ...(req.sessionId ? ['--resume', req.sessionId] : []),
        ...(req.model ? ['--model', req.model] : []),
        ...(req.effort ? ['--effort', req.effort] : []),
        ...(req.settingsJson ? ['--settings', req.settingsJson] : []),
        ...(req.permissionMode ? ['--permission-mode', req.permissionMode] : [])
      ]
      const pty = spawn(program, args, {
        name: 'xterm-256color',
        cols: req.cols,
        rows: req.rows,
        cwd,
        env
      })
      const session: Session = { pty, buffer: '', account, cwd, shell: req.shell ? basename(shell) : undefined }
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
      return { ok: false, error: `Não consegui abrir o ${req.shell ? shell : 'claude'}: ${(err as Error).message}` }
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
    const { pid } = session.pty
    session.pty.kill()
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
  // um comando rodando no shell (o processo da frente não é mais o próprio shell).
  busy(): string[] {
    const status = liveStatusByPid()
    return [...this.sessions.values()]
      .filter((s) => (s.shell ? s.pty.process !== s.shell : (status.get(s.pty.pid) ?? 'idle') !== 'idle'))
      .map((s) => s.cwd)
  }

  killAll(): void {
    for (const key of [...this.sessions.keys()]) this.kill(key)
  }

  // Conta removida: o login dela some, então os terminais dela também.
  killAccount(account: string): void {
    for (const [key, s] of [...this.sessions]) if (s.account === account) this.kill(key)
  }
}
