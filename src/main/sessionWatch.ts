import { watch, type FSWatcher } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { sessionsDir } from './sessions'

// Avisa na hora que uma conversa mudou, em vez de esperar a próxima conferência:
// - a pasta de sessões de cada projeto (o .jsonl cresce a cada mensagem);
// - ~/.claude/sessions, onde todo Claude Code aberto grava o status (rodando, parado...).
const STATUS_DIR = join(homedir(), '.claude', 'sessions')
// Várias gravações seguidas viram um aviso só.
const SETTLE_MS = 60

export class SessionWatch {
  private projects = new Map<string, FSWatcher | null>()
  private status: FSWatcher | null = null
  private timers = new Map<string, NodeJS.Timeout>()

  constructor(private onChange: (projectPath: string) => void) {}

  private notify(path: string): void {
    clearTimeout(this.timers.get(path))
    this.timers.set(
      path,
      setTimeout(() => {
        this.timers.delete(path)
        this.onChange(path)
      }, SETTLE_MS)
    )
  }

  private open(dir: string, onEvent: () => void): FSWatcher | null {
    try {
      const w = watch(dir, onEvent)
      w.on('error', () => w.close())
      return w
    } catch {
      // Pasta ainda não existe (projeto sem conversas): a conferência periódica cobre.
      return null
    }
  }

  // Pastas do canvas que estão na tela; troca a lista inteira a cada chamada.
  setProjects(paths: string[]): void {
    const wanted = new Set(paths)
    for (const [path, w] of this.projects) {
      if (wanted.has(path)) continue
      w?.close()
      this.projects.delete(path)
    }
    for (const path of wanted) {
      // Tenta de novo quem ainda não tinha pasta.
      if (this.projects.get(path)) continue
      this.projects.set(path, this.open(sessionsDir(path), () => this.notify(path)))
    }
    if (!this.status) {
      // Status mudou em algum Claude Code: não dá para saber de qual projeto sem ler; avisa todos.
      this.status = this.open(STATUS_DIR, () => this.projects.forEach((_, p) => this.notify(p)))
    }
  }

  close(): void {
    this.projects.forEach((w) => w?.close())
    this.projects.clear()
    this.status?.close()
    this.status = null
    this.timers.forEach((t) => clearTimeout(t))
  }
}
