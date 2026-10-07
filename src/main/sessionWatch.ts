import { watch, type FSWatcher } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { gitDir } from './gitBranch'
import { sessionsDir } from './sessions'

// Avisa na hora que uma conversa mudou, em vez de esperar a próxima conferência:
// - a pasta de sessões de cada projeto (o .jsonl cresce a cada mensagem);
// - ~/.claude/sessions, onde todo Claude Code aberto grava o status (rodando, parado...);
// - o HEAD e o index do git de cada projeto, para a branch e os arquivos não comitados
//   mudarem junto com um checkout, um add ou um commit.
const STATUS_DIR = join(homedir(), '.claude', 'sessions')
// Várias gravações seguidas viram um aviso só.
const SETTLE_MS = 60

type Watchers = { sessions: FSWatcher | null; head: FSWatcher | null }

export class SessionWatch {
  private projects = new Map<string, Watchers>()
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

  private open(dir: string, onEvent: (file: string | null) => void): FSWatcher | null {
    try {
      const w = watch(dir, (_event, file) => onEvent(file))
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
      w.sessions?.close()
      w.head?.close()
      this.projects.delete(path)
    }
    for (const path of wanted) {
      // Tenta de novo quem ainda não tinha pasta de sessões ou repositório.
      const w = this.projects.get(path) ?? { sessions: null, head: null }
      w.sessions ??= this.open(sessionsDir(path), () => this.notify(path))
      // O git troca HEAD e index gravando um .lock e renomeando; o resto da pasta .git não interessa.
      const git = w.head ? null : gitDir(path)
      if (git) w.head = this.open(git, (file) => (file?.startsWith('HEAD') || file?.startsWith('index')) && this.notify(path))
      this.projects.set(path, w)
    }
    if (!this.status) {
      // Status mudou em algum Claude Code: não dá para saber de qual projeto sem ler; avisa todos.
      this.status = this.open(STATUS_DIR, () => this.projects.forEach((_, p) => this.notify(p)))
    }
  }

  close(): void {
    this.projects.forEach((w) => {
      w.sessions?.close()
      w.head?.close()
    })
    this.projects.clear()
    this.status?.close()
    this.status = null
    this.timers.forEach((t) => clearTimeout(t))
  }
}
