import { join, resolve } from 'node:path'
import type { WorktreeInfo, WorktreeStatus } from '../../shared/worktrees'
import { git } from '../gitBranch/git'
import { currentBranch } from '../gitBranch/repo'
import { uncommittedFiles } from '../gitBranch/status'
import { failures, preparing } from './create'
import { worktreeOf } from './store'

// Onde a base está para comparar: a local, ou a do remoto se só existir lá.
async function baseRef(info: WorktreeInfo): Promise<string | null> {
  for (const ref of [info.base, `origin/${info.base}`]) {
    const ok = await git(info.path, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).then(
      () => true,
      () => false
    )
    if (ok) return ref
  }
  return null
}

// Commits desta branch que o remoto não tem. Sem branch no remoto, todos desde a base.
export async function unpushedCount(info: WorktreeInfo): Promise<number> {
  const count = (range: string) => git(info.path, ['rev-list', '--count', range]).then((out) => Number(out.trim()) || 0)
  try {
    return await count('@{u}..HEAD')
  } catch {
    const base = await baseRef(info)
    return base ? count(`${base}..HEAD`).catch(() => 0) : 0
  }
}

export async function worktreeStatus(path: string): Promise<WorktreeStatus | null> {
  const info = worktreeOf(path)
  if (!info) return null
  const error = failures.get(info.path)
  if (info.pending)
    return { state: preparing.has(info.path) ? 'preparing' : 'pending', ...(error && { error }), branch: null, files: 0, uncommitted: 0, unpushed: 0 }
  const root = resolve(info.path)
  const pending = (await uncommittedFiles(root))?.map((f) => f.path) ?? []
  const files = new Set(pending)
  const base = await baseRef(info)
  if (base) {
    const out = await git(root, ['diff', '--name-only', '-z', `${base}...HEAD`], { maxBuffer: 16 * 1024 * 1024 }).catch(() => '')
    for (const f of out.split('\0').filter(Boolean)) files.add(join(root, f))
  }
  return {
    state: preparing.has(info.path) ? 'preparing' : 'ready',
    ...(error && { error }),
    branch: currentBranch(info.path),
    files: files.size,
    uncommitted: pending.length,
    unpushed: await unpushedCount(info)
  }
}
