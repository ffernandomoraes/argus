import { memo } from 'react'
import { Code2, Plus } from 'lucide-react'
import { ProjectServerButton } from '../../devServers/ProjectServerButton'
import { IconButton } from '../../ui/IconButton'
import { Tooltip } from '../../ui/Tooltip'
import { useCanvasActions } from '../CanvasContext'
import { useBranch, useUncommitted } from '../sessionsStore'
import { useIsCodeOpen } from '../useCanvasView'
import { BranchSwitcher } from './BranchSwitcher'
import type { ProjectData } from '../types'
import { WorktreeBranchTag } from '../worktrees/WorktreeStrip'
import { tr } from '../../i18n'

// O que fica fora do card da pasta, logo acima dele: a branch atual (clicar troca) no canto esquerdo e as
// ações (servidor, código e "+") no direito, na mesma altura e no mesmo estilo. No workspace, só o
// "+": branch, servidor e código seriam só da primeira pasta, e cada pasta pode ser um repositório.
export const ProjectActions = memo(function ProjectActions({ nodeId, project }: { nodeId: string; project: ProjectData }) {
  const { path } = project
  const workspace = !!project.folders
  const repoBranch = useBranch(path)
  // Tarefa isolada: a branch fica no card (com a base) e não troca; trocar quebraria o worktree.
  const branch = workspace || project.worktree ? null : repoBranch
  const uncommitted = useUncommitted(path)
  return (
    // Uma linha só: a branch ocupa o que sobra e corta o nome; as ações nunca encolhem (a pílula
    // do servidor muda de largura). A linha não pega clique, só o que está nela.
    <div className="pointer-events-none absolute bottom-full left-0 right-0 mb-1.5 flex items-center gap-2">
      {branch && (
        <div className="pointer-events-auto flex min-w-0">
          <BranchSwitcher path={path} branch={branch} changes={uncommitted?.length} />
        </div>
      )}
      {project.worktree && <WorktreeBranchTag path={path} />}
      <div className="nodrag pointer-events-auto ml-auto flex shrink-0 items-center gap-1">
        {!workspace && <ProjectServerButton path={path} />}
        {!workspace && <CodeButton project={project} />}
        <NewButton nodeId={nodeId} />
      </div>
    </div>
  )
})

// Abre (ou fecha) o painel de código da pasta, o mesmo que a conversa abre. Fica destacado
// enquanto o painel mostra esta pasta. Também em cada pasta do workspace (WorkspaceFolders).
export function CodeButton({ project }: { project: ProjectData }) {
  const { toggleProjectCode } = useCanvasActions()
  const open = useIsCodeOpen(project.path)
  const label = open ? tr('Fechar código', 'Close code') : tr('Ver código', 'View code')
  return (
    <IconButton
      label={label}
      title=""
      variant="floating"
      size="sm"
      pressed={open}
      className="group relative"
      onClick={() => toggleProjectCode(project, open)}
    >
      <Code2 size={13} />
      <Tooltip label={label} />
    </IconButton>
  )
}

// "+": abre direto uma conversa nova. Novo design fica só no menu do botão direito da pasta.
function NewButton({ nodeId }: { nodeId: string }) {
  const { newConversation } = useCanvasActions()
  return (
    <IconButton
      label={tr('Nova conversa', 'New chat')}
      title=""
      variant="floating"
      size="sm"
      className="group relative"
      onClick={() => newConversation(nodeId)}
    >
      <Plus size={13} />
      <Tooltip label={tr('Nova conversa', 'New chat')} />
    </IconButton>
  )
}
