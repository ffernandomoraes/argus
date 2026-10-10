import type { FSWatcher } from 'node:fs'
import type { LiveStatus } from '../../shared/history'
import type { SessionChange } from '../../shared/sessions'
import { statusDirs } from '../accounts'
import { forgetStatus, gitDir } from '../gitBranch'
import { liveSessions } from '../liveSessions'
import { projectDir, projectsDir } from '../transcripts/projectDir'
import { watchGit, type GitWatch } from './gitWatch'
import { changedSessions, projectsWith } from './statusChanges'
import { watchDir } from './watchDir'

// Avisa na hora que uma conversa mudou, em vez de esperar a próxima conferência:
// - a pasta de sessões de cada projeto (o .jsonl cresce a cada mensagem). Projeto ainda sem
//   conversas: vigia ~/.claude/projects até a pasta dele aparecer;
// - a pasta de status de cada conta (~/.claude/sessions e a das outras), onde todo Claude Code
//   aberto grava o status (rodando, parado...). Avisa só as pastas das conversas que mudaram;
// - o HEAD e o index do git de cada projeto, para a branch e os arquivos não comitados
//   mudarem junto com um checkout, um add ou um commit (ver gitWatch.ts).
// Várias gravações seguidas viram um aviso só, por pasta e por motivo (ver SessionChange): a
// janela relê só o que o motivo pede.
const SETTLE_MS = 60
// Chaves dos avisos que não são de uma pasta (caminho nunca tem \0).
const RETRY = '\0projects'
const STATUS = '\0status'

type Watchers = { sessions: FSWatcher | null; git: GitWatch | null }

export class SessionWatch {
  private projects = new Map<string, Watchers>()
  private status = new Map<string, FSWatcher | null>()
  // ~/.claude/projects, enquanto algum projeto ainda não tem pasta de sessões.
  private parent: FSWatcher | null = null
  private timers = new Map<string, NodeJS.Timeout>()
  // Último status lido de todas as sessões: a base para saber quem mudou.
  private live: Map<string, LiveStatus> | null = null
  private checking = false
  private recheck = false
  private closed = false

  constructor(private onChange: (projectPath: string, change: SessionChange) => void) {}

  private later(key: string, run: () => void): void {
    if (this.closed) return
    clearTimeout(this.timers.get(key))
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key)
        run()
      }, SETTLE_MS)
    )
  }

  // Chave do aviso: o motivo e a pasta (caminho nunca tem \0, e o motivo não começa com ele).
  private notify(path: string, change: SessionChange): void {
    this.later(`${change}\0${path}`, () => {
      // O .git mudou: a próxima leitura do git status roda de novo, em vez de devolver a guardada
      // (que pode ser de antes do commit ou do add, se houve leitura menos de 1 s antes).
      if (change === 'git') forgetStatus(path)
      this.onChange(path, change)
    })
  }

  // Pastas do canvas que estão na tela; troca a lista inteira a cada chamada.
  setProjects(paths: string[]): void {
    const wanted = new Set(paths)
    for (const [path, w] of this.projects) {
      if (wanted.has(path)) continue
      w.sessions?.close()
      w.git?.close()
      this.projects.delete(path)
    }
    for (const path of wanted) {
      // Tenta de novo quem ainda não tinha pasta de sessões ou repositório.
      const w = this.projects.get(path) ?? { sessions: null, git: null }
      this.projects.set(path, w)
      w.sessions ??= this.watchSessions(path)
      const git = w.git ? null : gitDir(path)
      if (git) w.git = this.watchRepo(path, git)
    }
    this.syncParent()
    this.refreshStatusDirs()
  }

  private watchSessions(path: string): FSWatcher | null {
    const w: FSWatcher | null = watchDir(
      projectDir(path),
      () => this.notify(path, 'transcript'),
      () => {
        const entry = this.projects.get(path)
        if (entry?.sessions !== w) return
        entry.sessions = null
        this.syncParent()
      }
    )
    return w
  }

  private watchRepo(path: string, dir: string): GitWatch | null {
    const g: GitWatch | null = watchGit(
      dir,
      () => this.notify(path, 'git'),
      () => {
        const entry = this.projects.get(path)
        if (entry?.git === g) entry.git = null
      }
    )
    return g
  }

  // Projeto sem pasta de sessões (nenhuma conversa ainda, ou a pasta deu erro): ela aparece em
  // ~/.claude/projects quando a primeira conversa começa.
  private syncParent(): void {
    const missing = [...this.projects.values()].some((w) => !w.sessions)
    if (missing && !this.parent) {
      const p: FSWatcher | null = watchDir(
        projectsDir(),
        () => this.later(RETRY, () => this.retryMissing()),
        () => {
          if (this.parent === p) this.parent = null
        }
      )
      this.parent = p
    } else if (!missing && this.parent) {
      this.parent.close()
      this.parent = null
    }
  }

  private retryMissing(): void {
    for (const [path, w] of this.projects) {
      if (w.sessions) continue
      w.sessions = this.watchSessions(path)
      // A pasta apareceu: chegou a primeira conversa.
      if (w.sessions) this.notify(path, 'transcript')
    }
    this.syncParent()
  }

  // Uma pasta de status por conta; chamada de novo quando uma conta entra ou sai.
  refreshStatusDirs(): void {
    const wanted = new Set(statusDirs())
    for (const [dir, w] of this.status) {
      if (wanted.has(dir)) continue
      w?.close()
      this.status.delete(dir)
    }
    for (const dir of wanted) {
      if (this.status.get(dir)) continue
      const w: FSWatcher | null = watchDir(
        dir,
        () => this.later(STATUS, () => void this.checkStatus()),
        () => {
          if (this.status.get(dir) === w) this.status.set(dir, null)
        }
      )
      this.status.set(dir, w)
    }
    // Base para comparar os próximos avisos.
    if (!this.live) void this.checkStatus()
  }

  // Status mudou em algum Claude Code: lê todos uma vez e avisa só as pastas das conversas que
  // mudaram. Antes avisava todas, e cada janela relia a lista de todas as pastas e rodava git.
  private async checkStatus(): Promise<void> {
    if (this.checking) {
      this.recheck = true
      return
    }
    this.checking = true
    try {
      do {
        this.recheck = false
        const now = await liveSessions()
        const before = this.live
        this.live = now
        if (!before) continue
        const changed = changedSessions(before, now)
        if (changed.length) for (const path of projectsWith(changed, this.projects.keys())) this.notify(path, 'status')
      } while (this.recheck)
    } finally {
      this.checking = false
    }
  }

  close(): void {
    this.closed = true
    this.projects.forEach((w) => {
      w.sessions?.close()
      w.git?.close()
    })
    this.projects.clear()
    this.status.forEach((w) => w?.close())
    this.status.clear()
    this.parent?.close()
    this.parent = null
    this.timers.forEach((t) => clearTimeout(t))
    this.timers.clear()
  }
}
