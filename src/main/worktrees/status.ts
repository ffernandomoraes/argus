import { readFile, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { WorktreeInfo, WorktreeStatus } from '../../shared/worktrees'
import { git } from '../gitBranch/git'
import { currentBranch, gitDir } from '../gitBranch/repo'
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

// Commits desta branch que o remoto não tem. Sem branch no remoto, todos desde a base (`base`: já
// procurada por quem chama).
export async function unpushedCount(info: WorktreeInfo, base?: string | null): Promise<number> {
  const count = (range: string) => git(info.path, ['rev-list', '--count', range]).then((out) => Number(out.trim()) || 0)
  try {
    return await count('@{u}..HEAD')
  } catch {
    const ref = base === undefined ? await baseRef(info) : base
    return ref ? count(`${ref}..HEAD`).catch(() => 0) : 0
  }
}

// Uma leitura por worktree de cada vez: quem pergunta no meio dela (a faixa do card de cada janela,
// a cada poucos segundos) espera a mesma. Antes cada pergunta abria a sua, e com o WSL lento elas se
// acumulavam, cada uma com quatro a seis git rodando lá dentro (2026-10-23).
const reading = new Map<string, Promise<WorktreeStatus>>()

export function worktreeStatus(path: string): Promise<WorktreeStatus | null> {
  const info = worktreeOf(path)
  if (!info) return Promise.resolve(null)
  let job = reading.get(info.path)
  if (!job) {
    job = readStatus(info).finally(() => reading.delete(info.path))
    reading.set(info.path, job)
  }
  return job
}

async function readStatus(info: WorktreeInfo): Promise<WorktreeStatus> {
  const error = failures.get(info.path)
  if (info.pending)
    return { state: preparing.has(info.path) ? 'preparing' : 'pending', ...(error && { error }), branch: null, files: 0, uncommitted: 0, unpushed: 0 }
  const root = resolve(info.path)
  const pending = (await uncommittedFiles(root))?.map((f) => f.path) ?? []
  const commits = await committedPart(info, root)
  const files = new Set([...pending, ...commits.files])
  return {
    state: preparing.has(info.path) ? 'preparing' : 'ready',
    ...(error && { error }),
    branch: await currentBranch(info.path),
    files: files.size,
    uncommitted: pending.length,
    unpushed: commits.unpushed
  }
}

// O que só muda com commit, troca de branch, push ou fetch: os arquivos que a branch mudou desde a
// base e os commits sem enviar. Antes eram três a cinco git a cada leitura; no WSL, cada um é um
// wsl.exe (2026-11-03, digitação lenta com tarefas em paralelo). Agora só rodam de novo quando o
// HEAD ou o histórico dele mudam (lidos do arquivo, sem git) ou depois de COMMITS_TTL_MS, que pega
// o push e o fetch (eles não mexem nesses arquivos). O VS Code também lê o HEAD do arquivo.
const COMMITS_TTL_MS = 60_000
type Committed = { files: string[]; unpushed: number }
const committed = new Map<string, { key: string; at: number; value: Committed }>()

async function committedPart(info: WorktreeInfo, root: string): Promise<Committed> {
  const key = `${info.base}|${await headSignature(info.path)}`
  const hit = committed.get(info.path)
  if (hit && hit.key === key && Date.now() - hit.at < COMMITS_TTL_MS) return hit.value
  const base = await baseRef(info)
  const files: string[] = []
  if (base) {
    const out = await git(root, ['diff', '--name-only', '-z', `${base}...HEAD`], { maxBuffer: 16 * 1024 * 1024 }).catch(() => '')
    for (const f of out.split('\0').filter(Boolean)) files.push(join(root, f))
  }
  const value = { files, unpushed: await unpushedCount(info, base) }
  committed.set(info.path, { key, at: Date.now(), value })
  return value
}

// Retrato do HEAD do worktree: para onde ele aponta e o histórico dele (logs/HEAD, gravado a cada
// commit, reset, checkout ou rebase nele). Sem conseguir ler, vazio: vale só o prazo.
async function headSignature(path: string): Promise<string> {
  const dir = await gitDir(path)
  if (!dir) return ''
  const [head, log] = await Promise.all([
    readFile(join(dir, 'HEAD'), 'utf8').then(
      (text) => text.trim(),
      () => ''
    ),
    stat(join(dir, 'logs', 'HEAD')).then(
      (s) => `${s.mtimeMs}:${s.size}`,
      () => ''
    )
  ])
  return `${head}|${log}`
}
