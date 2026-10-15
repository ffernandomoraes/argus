import { join, resolve } from 'node:path'
import { app } from 'electron'
import { readJsonFile, writeJsonAtomicSync } from '../lib/jsonFile'
import { expandHome } from '../paths'
import { IS_WIN } from '../platform'
import type { WorktreeInfo } from '../../shared/worktrees'

// Os worktrees que o Argus criou (branch, base, repositório principal), pela pasta. Lido a cada
// mensagem para o aviso oculto: fica em memória, e o disco só é lido na primeira vez.

const file = () => join(app.getPath('userData'), 'worktrees.json')

const key = (path: string): string => {
  const full = resolve(expandHome(path))
  return IS_WIN ? full.toLowerCase() : full
}

let cache: Record<string, WorktreeInfo> | null = null

function all(): Record<string, WorktreeInfo> {
  if (cache) return cache
  const read = readJsonFile<Record<string, WorktreeInfo>>(file())
  cache = read.status === 'ok' && read.data && typeof read.data === 'object' ? read.data : {}
  return cache
}

function save(): void {
  try {
    writeJsonAtomicSync(file(), all())
  } catch {
    // sem gravar, vale até o app fechar
  }
}

export function updateWorktree(path: string, patch: Partial<WorktreeInfo>): void {
  const k = key(path)
  const current = all()[k]
  if (!current) return
  all()[k] = { ...current, ...patch }
  if (patch.pending === false) delete all()[k].pending
  save()
}

export function rememberWorktree(info: WorktreeInfo): void {
  all()[key(info.path)] = info
  save()
}

export function forgetWorktree(path: string): void {
  delete all()[key(path)]
  save()
}

export const allWorktrees = (): WorktreeInfo[] => Object.values(all())

// O worktree que contém a pasta (a raiz dele ou uma pasta dentro, como apps/checkout).
export function worktreeOf(path: string): WorktreeInfo | null {
  const k = key(path)
  const sep = IS_WIN ? '\\' : '/'
  for (const [root, info] of Object.entries(all())) if (k === root || k.startsWith(root + sep)) return info
  return null
}
