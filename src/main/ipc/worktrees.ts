import { adoptWorktree, removeWorktree, reserveWorktree, worktreeStatus } from '../worktrees'
import { handle } from './register'

// Tarefas isoladas em git worktrees: reservar, situação e remover. A criação de fato acontece no
// primeiro envio da conversa (ipc/chat.ts) ou ao abrir o terminal (terminals/spawnTerminal.ts).
export function registerWorktreesIpc(): void {
  handle('worktrees:reserve', (_e, folder) => reserveWorktree(folder))
  handle('worktrees:adopt', (_e, path, from) => adoptWorktree(path, from))
  handle('worktrees:status', (_e, path) => worktreeStatus(path))
  handle('worktrees:remove', (_e, path) => removeWorktree(path))
}
