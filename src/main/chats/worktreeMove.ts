import type { ChatWorktree } from '../../shared/chat'
import { fromLinux, parseWslPath } from '../wsl/path'

// O que o SDK manda junto do resultado do EnterWorktree ({ worktreePath, worktreeBranch, message }) e
// do ExitWorktree ({ action, originalCwd, worktreePath, ... }). Outras ferramentas também podem
// trazer worktreePath (o Agent com isolation: worktree): só vale com exatamente estes campos.
const ENTER_FIELDS = new Set(['worktreePath', 'worktreeBranch', 'message'])

// Caminho escrito pelo Claude visto pelo Argus: o Claude que roda no WSL escreve /home/...
function seen(path: string, cwd: string): string {
  const wsl = parseWslPath(cwd)
  return wsl && path.startsWith('/') ? fromLinux(wsl.distro, path) : path
}

// Entrou num worktree ou saiu dele, pelo resultado da ferramenta; nulo se não foi isso. `cwd`: a
// pasta da sessão, de onde a conversa sai ao entrar.
export function worktreeMove(result: unknown, cwd: string): ChatWorktree | null {
  if (!result || typeof result !== 'object') return null
  const r = result as Record<string, unknown>
  if (typeof r.worktreePath !== 'string') return null
  const path = seen(r.worktreePath, cwd)
  const branch = typeof r.worktreeBranch === 'string' ? r.worktreeBranch : undefined
  if ((r.action === 'keep' || r.action === 'remove') && typeof r.originalCwd === 'string')
    return { path, from: seen(r.originalCwd, cwd), ...(branch && { branch }), left: r.action }
  if (typeof r.message !== 'string' || Object.keys(r).some((k) => !ENTER_FIELDS.has(k))) return null
  return { path, from: cwd, ...(branch && { branch }) }
}
