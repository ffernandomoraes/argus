import { worktreePrompt } from '../../shared/worktrees'
import { currentBranch } from '../gitBranch/repo'
import { worktreeOf } from './store'

// Conversa ou terminal num worktree do Argus: o aviso dele entra junto do aviso oculto que já
// existir (orquestrador, agentes chamados com @), como o orquestrador faz. A branch é lida na hora:
// o agente renomeia a provisória.
export function withWorktreeHint(hint: string | undefined, cwd: string): string | undefined {
  const info = worktreeOf(cwd)
  if (!info) return hint
  const extra = worktreePrompt(info, currentBranch(info.path))
  return hint ? `${hint}\n\n${extra}` : extra
}
