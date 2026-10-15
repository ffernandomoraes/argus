import { memo, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { BranchLabel } from '../BranchLabel'
import { useCanvasActions } from '../CanvasContext'
import { useSessions } from '../sessionsStore'
import { useWorktreeJob } from './jobs'
import { usePollWorktree, useWorktreeStatus } from './useWorktreeStatus'
import { tr } from '../../i18n'

// Nome do card até a conversa ganhar título (ver useWorktreeActions).
const PLACEHOLDER_NAMES = new Set(['Nova tarefa', 'New task'])

// Faixa no pé do card da tarefa em paralelo: só quando algo falhou (criar a
// cópia, instalar as dependências, remover). O card ganha o título da primeira conversa.
export const WorktreeStrip = memo(function WorktreeStrip({ nodeId, name, path }: { nodeId: string; name: string; path: string }) {
  const job = useWorktreeJob(nodeId)
  const status = usePollWorktree(path)
  const conversations = useSessions(path)
  const { finishRename } = useCanvasActions()
  const title = conversations.find((c) => !c.draft)?.title
  useEffect(() => {
    if (title && PLACEHOLDER_NAMES.has(name)) finishRename(nodeId, title)
  }, [title, name, nodeId, finishRename])

  // Só o erro aparece aqui; o resto (criando, removendo) fica na linha animada e no card piscando.
  const error = job?.kind === 'failed' ? job.error : status?.error
  if (!error) return null
  return (
    <p className="flex items-start gap-1.5 border-t border-line px-3 py-2 text-[11px] leading-snug text-red-400">
      <AlertCircle size={12} className="mt-px shrink-0" />
      <span className="line-clamp-3 whitespace-pre-wrap">{error}</span>
    </p>
  )
})

// Selo acima do card, no lugar e no estilo da branch das outras pastas: a branch da tarefa agora (a
// provisória wip/... até o agente renomear) e, na frente, quantos arquivos a tarefa alterou desde a
// base. Não troca de branch: o worktree é preso a ela. Antes da primeira mensagem, não aparece.
export function WorktreeBranchTag({ path }: { path: string }) {
  const status = useWorktreeStatus(path)
  if (!status?.branch) return null
  const files = status.files
  return (
    <div className="pointer-events-auto flex h-6 min-w-0 items-center rounded-md border border-line bg-surface px-2 text-[12px] text-muted shadow-sm">
      <BranchLabel
        branch={status.branch}
        changes={files}
        highlight
        changesTitle={files === 1 ? tr('1 arquivo alterado na tarefa', '1 file changed in the task') : tr(`${files} arquivos alterados na tarefa`, `${files} files changed in the task`)}
      />
    </div>
  )
}
