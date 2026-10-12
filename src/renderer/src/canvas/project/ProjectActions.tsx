import { memo } from 'react'
import { Plus } from 'lucide-react'
import { ProjectServerButton } from '../../devServers/ProjectServerButton'
import { IconButton } from '../../ui/IconButton'
import { Tooltip } from '../../ui/Tooltip'
import { BranchLabel } from '../BranchLabel'
import { useCanvasActions } from '../CanvasContext'
import { useBranch, useUncommitted } from '../sessionsStore'

// O que fica fora do card da pasta, logo acima dele: a branch atual no canto esquerdo e as
// ações (servidor e "+") no direito, na mesma altura e no mesmo estilo.
export const ProjectActions = memo(function ProjectActions({ nodeId, path }: { nodeId: string; path: string }) {
  const branch = useBranch(path)
  const uncommitted = useUncommitted(path)
  return (
    <>
      {branch && (
        <div className="absolute bottom-full left-0 mb-1.5 flex h-6 max-w-[calc(100%-64px)] items-center rounded-md border border-line bg-surface px-2 text-[12px] text-muted shadow-sm">
          <BranchLabel branch={branch} changes={uncommitted?.length} highlight />
        </div>
      )}
      <div className="nodrag absolute bottom-full right-0 mb-1.5 flex items-center gap-1">
        <ProjectServerButton path={path} />
        <NewButton nodeId={nodeId} />
      </div>
    </>
  )
})

// "+": abre direto uma conversa nova. Novo design fica só no menu do botão direito da pasta.
function NewButton({ nodeId }: { nodeId: string }) {
  const { newConversation } = useCanvasActions()
  return (
    <IconButton
      label="Nova conversa"
      title=""
      variant="floating"
      size="sm"
      className="group relative"
      onClick={() => newConversation(nodeId)}
    >
      <Plus size={13} />
      <Tooltip label="Nova conversa" />
    </IconButton>
  )
}
