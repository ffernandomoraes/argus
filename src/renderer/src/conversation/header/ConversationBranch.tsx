import type { ReactNode } from 'react'
import { useBranch, useUncommitted } from '../../canvas/sessionsStore'
import { BranchTag } from './BranchTag'

// Linha discreta em cima da caixa de escrever: à esquerda o que quem mostra a conversa manda antes
// (o remote control ligado) e a branch; à direita, o que quem mostra a
// conversa manda (o botão do código, no drawer). Workspace (folders): sem branch, cada pasta pode ser
// um repositório diferente; fora de repositório, também não aparece.
export function ConversationBranch({
  cwd,
  folders,
  onOpenDiff,
  start,
  end
}: {
  cwd: string
  folders?: string[]
  onOpenDiff?: (path: string) => void
  start?: ReactNode
  end?: ReactNode
}) {
  // Branch atual da pasta: é nela que o Claude vai trabalhar ao responder.
  const repoBranch = useBranch(cwd)
  const branch = folders ? null : repoBranch
  const uncommitted = useUncommitted(cwd)
  if (!branch && !start && !end) return null

  return (
    <div className="no-drag nodrag mb-1 flex min-w-0 items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1">
        {start}
        {branch && <BranchTag cwd={cwd} branch={branch} files={uncommitted} onOpenDiff={onOpenDiff} />}
      </div>
      {end}
    </div>
  )
}
